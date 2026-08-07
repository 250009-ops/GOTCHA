import {
  Injectable,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { PracticeType } from '@prisma/client';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { PrismaService } from '../../prisma/prisma.service';
import { LookupDto } from './dto/ai.dto';
import {
  AiPlatformSettings,
  defaultAiPlatformSettings,
  parseAiPlatformSettings,
  AI_SETTING_KEYS,
} from './ai-settings';

type MemoryLookup = {
  lemma: string;
  translation: string;
  grammarNote: string | null;
  partOfSpeech: string | null;
};

const LOOKUP_CONTEXT_MAX = 500;
const LOOKUP_GLOSS_MAX_CHARS = 80;
const LOOKUP_GLOSS_MAX_WORDS = 12;
/** In-memory LRU size in front of DB (and for offline/dev). */
const MEMORY_LRU_MAX = 800;
/** Cache key scheme — bump when normalization/keying rules change. */
const LOOKUP_CACHE_VERSION = 'v3';

const LOOKUP_SYSTEM_PROMPT = `You are a bilingual dictionary for language learners.
Return ONLY JSON: {"lemma":"","translation":"","phraseIfAny":null}

Rules:
- Focus ONLY on the tapped target word (surface/lemma).
- If that word is clearly part of an idiom, phrasal verb, or multi-word expression with adjacent words in the context, set phraseIfAny to that short phrase (2–5 words) and gloss THAT phrase instead.
- "translation" = a short gloss in the learner's language (1–6 words). Never a sentence, paragraph, story, or full-context translation.
- "lemma" = dictionary form of the target word, or the short phrase when phraseIfAny is set.
- Do NOT include explanations, grammar notes, part-of-speech lectures, senses, or example sentences.
- Use the context sentence only to pick the right short meaning — never translate the context itself.`;

function clampContext(text: string): string {
  const trimmed = (text ?? '').trim();
  if (trimmed.length <= LOOKUP_CONTEXT_MAX) return trimmed;
  return trimmed.slice(0, LOOKUP_CONTEXT_MAX).trim();
}

/** Lowercase/trim and strip edge punctuation for stable cache keys. */
function normalizeLemmaKey(raw: string): string {
  return (raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/^[\s"'«»„“”‘’(\[{<]+|[\s"'«»„“”‘’).,!?;:…\]}>]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collapse whitespace + lowercase for sentence hashing (privacy-safe shared key). */
function normalizeSentenceForHash(raw: string): string {
  return clampContext(raw)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'«»„“”‘’]+|[\s"'«»„“”‘’]+$/g, '')
    .trim();
}

/** Keep TRANSLATION as a short gloss; reject passage-length dumps. */
function sanitizeGloss(raw: unknown, fallback: string): string {
  if (typeof raw !== 'string') return fallback;
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return fallback;

  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const sentenceEnds = (t.match(/[.!?。！？]/g) ?? []).length;
  const looksLikePassage = t.length > LOOKUP_GLOSS_MAX_CHARS || wordCount > LOOKUP_GLOSS_MAX_WORDS || sentenceEnds > 1;

  if (looksLikePassage) {
    // Prefer the first short comma/semicolon/dash chunk if it is gloss-sized.
    const chunk = t.split(/[,;–—:：]/)[0]?.trim() ?? t;
    if (chunk.split(/\s+/).length <= LOOKUP_GLOSS_MAX_WORDS && chunk.length <= LOOKUP_GLOSS_MAX_CHARS) {
      t = chunk;
    } else {
      t = t.split(/\s+/).slice(0, 6).join(' ');
    }
  }

  if (t.length > LOOKUP_GLOSS_MAX_CHARS) {
    t = t.slice(0, LOOKUP_GLOSS_MAX_CHARS).trim();
  }
  return t || fallback;
}

@Injectable()
export class AiService {
  private client: OpenAI | null = null;
  private clientKey: string | null = null;
  /** Hot-path LRU (Map insertion order) shared across users — no PII, lemma glosses only. */
  private readonly memoryCache = new Map<string, MemoryLookup>();
  private readonly memoryUsage = new Map<string, number>();
  private memoryPlatformLookups = 0;

  constructor(private prisma: PrismaService) {}

  private useMemory() {
    return isDevAuthEnabled() && !this.prisma.dbAvailable;
  }

  private getApiKey() {
    const key = process.env.OPENAI_API_KEY?.trim();
    return key || null;
  }

  private getClient() {
    const key = this.getApiKey();
    if (!key) return null;
    if (!this.client || this.clientKey !== key) {
      this.client = new OpenAI({
        apiKey: key,
        ...(process.env.OPENAI_BASE_URL
          ? { baseURL: process.env.OPENAI_BASE_URL }
          : {}),
      });
      this.clientKey = key;
    }
    return this.client;
  }

  async getPlatformAiSettings(): Promise<AiPlatformSettings> {
    if (this.useMemory()) {
      return defaultAiPlatformSettings();
    }

    const rows = await this.prisma.platformSetting.findMany({
      where: {
        key: {
          in: Object.values(AI_SETTING_KEYS),
        },
      },
    });
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }
    return parseAiPlatformSettings(map);
  }

  private async assertAiAvailable(settings: AiPlatformSettings) {
    if (!settings.enabled) {
      throw new ForbiddenException(
        'AI features are currently disabled by an administrator.',
      );
    }

    if (this.useMemory()) {
      if (this.memoryPlatformLookups >= settings.dailyLimit) {
        throw new ForbiddenException('Platform AI daily limit reached. Try again tomorrow.');
      }
      return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const agg = await this.prisma.aiUsageDaily.aggregate({
      where: { usageDate: today },
      _sum: { lookupCount: true, quizCount: true },
    });
    const used = (agg._sum.lookupCount ?? 0) + (agg._sum.quizCount ?? 0);
    if (used >= settings.dailyLimit) {
      throw new ForbiddenException('Platform AI daily limit reached. Try again tomorrow.');
    }
  }

  private contentHash(text: string) {
    return createHash('sha256').update(text).digest('hex').slice(0, 32);
  }

  private sentenceHash(sentence: string) {
    return createHash('sha256')
      .update(normalizeSentenceForHash(sentence))
      .digest('hex')
      .slice(0, 16);
  }

  /**
   * Stable shared cache key: normalized lemma + language pair + sentence hash.
   * Does not store raw user text in the key beyond a hash; safe to share across users.
   */
  private buildLookupCacheKey(dto: LookupDto, surface: string, context: string) {
    const lemma = normalizeLemmaKey(dto.lemma?.trim() || surface) || normalizeLemmaKey(surface);
    const hash = this.contentHash(
      [
        LOOKUP_CACHE_VERSION,
        lemma,
        dto.sourceLang,
        dto.targetLang,
        this.sentenceHash(context),
      ].join('|'),
    );
    return { lemma, hash };
  }

  private memoryGet(hash: string): MemoryLookup | null {
    const hit = this.memoryCache.get(hash);
    if (!hit) return null;
    // Refresh LRU order.
    this.memoryCache.delete(hash);
    this.memoryCache.set(hash, hit);
    return hit;
  }

  private memorySet(hash: string, value: MemoryLookup) {
    if (this.memoryCache.has(hash)) this.memoryCache.delete(hash);
    this.memoryCache.set(hash, value);
    while (this.memoryCache.size > MEMORY_LRU_MAX) {
      const oldest = this.memoryCache.keys().next().value;
      if (oldest === undefined) break;
      this.memoryCache.delete(oldest);
    }
  }

  private async checkQuota(userId: string, defaultUserQuota: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (this.useMemory()) {
      const key = `${userId}:${today.toISOString().slice(0, 10)}`;
      const used = this.memoryUsage.get(key) ?? 0;
      const quota = defaultUserQuota;
      if (used >= quota) {
        throw new ForbiddenException(
          'Daily AI quota exceeded. Try again tomorrow or upgrade your plan.',
        );
      }
      return { quota, usage: { lookupCount: used }, today, memoryKey: key };
    }

    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const quota = sub?.plan.aiDailyQuota ?? defaultUserQuota;

    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_usageDate: { userId, usageDate: today } },
    });

    // Values >= 1e6 match Premium "Unlimited AI lookups" from Landing pricing.
    if (quota < 1_000_000 && (usage?.lookupCount ?? 0) >= quota) {
      throw new ForbiddenException(
        'Daily AI quota exceeded. Try again tomorrow or upgrade your plan.',
      );
    }

    return { quota, usage, today, memoryKey: null as string | null };
  }

  private async incrementUsage(
    userId: string,
    today: Date,
    field: 'lookupCount' | 'quizCount',
    memoryKey: string | null,
  ) {
    if (memoryKey) {
      this.memoryUsage.set(memoryKey, (this.memoryUsage.get(memoryKey) ?? 0) + 1);
      this.memoryPlatformLookups += 1;
      return;
    }
    await this.prisma.aiUsageDaily.upsert({
      where: { userId_usageDate: { userId, usageDate: today } },
      create: { userId, usageDate: today, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  }

  /**
   * Lookup with layered cache:
   * 1) in-memory LRU (all modes)
   * 2) shared Prisma `lemma_cache` (when DB available)
   * 3) OpenAI (miss only)
   *
   * Quota / Admin AI Usage (`lookupCount`) increment only on successful uncached OpenAI calls.
   * Pure cache hits never burn quota or platform daily OpenAI budget.
   */
  async lookup(userId: string, dto: LookupDto) {
    const surface = (dto.token ?? '').trim();
    const context = clampContext(dto.sentence);
    const { lemma: cacheKeyLemma, hash } = this.buildLookupCacheKey(dto, surface, context);

    const fromMemory = this.memoryGet(hash);
    if (fromMemory) {
      return {
        lemma: fromMemory.lemma || cacheKeyLemma,
        translation: sanitizeGloss(fromMemory.translation, surface),
        grammarNote: fromMemory.grammarNote,
        partOfSpeech: fromMemory.partOfSpeech,
        cached: true,
      };
    }

    if (!this.useMemory()) {
      const cached = await this.prisma.lemmaCache.findUnique({
        where: {
          lemma_sourceLang_targetLang_contentHash: {
            lemma: cacheKeyLemma,
            sourceLang: dto.sourceLang,
            targetLang: dto.targetLang,
            contentHash: hash,
          },
        },
      });

      if (cached) {
        const payload: MemoryLookup = {
          lemma: cached.lemma || cacheKeyLemma,
          translation: sanitizeGloss(cached.translation, surface),
          grammarNote: null,
          partOfSpeech: cached.partOfSpeech ?? null,
        };
        this.memorySet(hash, payload);
        return { ...payload, cached: true };
      }
    }

    // Miss path only: enforce platform + user quota before spending OpenAI.
    const settings = await this.getPlatformAiSettings();
    await this.assertAiAvailable(settings);
    const { today, memoryKey } = await this.checkQuota(userId, settings.defaultUserQuota);

    const client = this.getClient();
    let lemma = cacheKeyLemma;
    let translation = surface;
    const grammarNote: string | null = null;
    const partOfSpeech: string | null = null;
    const model = settings.lookupModel;
    let usedOpenAi = false;

    if (client) {
      try {
        const response = await client.chat.completions.create({
          model,
          temperature: 0.1,
          max_tokens: 120,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: LOOKUP_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                `Target word (surface): "${surface}"`,
                dto.lemma ? `Lemma hint: "${dto.lemma}"` : null,
                `Context (disambiguation only — do NOT translate this): "${context}"`,
                `Gloss language: ${dto.targetLang}`,
                `Source language of the text: ${dto.sourceLang}`,
                'Return only the short gloss for the target word or short MWE.',
              ]
                .filter(Boolean)
                .join('\n'),
            },
          ],
        });
        usedOpenAi = true;

        try {
          const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
            lemma?: string;
            translation?: string;
            phraseIfAny?: string | null;
          };
          const phrase =
            typeof parsed.phraseIfAny === 'string' && parsed.phraseIfAny.trim()
              ? parsed.phraseIfAny.trim()
              : null;
          lemma = normalizeLemmaKey(phrase || parsed.lemma || cacheKeyLemma) || cacheKeyLemma;
          translation = sanitizeGloss(parsed.translation, surface);
        } catch {
          translation = sanitizeGloss(response.choices[0]?.message?.content, surface);
        }
      } catch (err) {
        // Do not cache errors / billing failures.
        const detail = err instanceof Error ? err.message : 'OpenAI request failed';
        throw new ServiceUnavailableException(
          `AI lookup failed: ${detail}. Check OPENAI_API_KEY and model settings.`,
        );
      }
    } else {
      // No API key — local-friendly fallback (not a live translation).
      translation = surface;
    }

    translation = sanitizeGloss(translation, surface);
    const payload: MemoryLookup = { lemma, translation, grammarNote, partOfSpeech };
    this.memorySet(hash, payload);

    if (!this.useMemory()) {
      try {
        await this.prisma.lemmaCache.upsert({
          where: {
            lemma_sourceLang_targetLang_contentHash: {
              lemma: cacheKeyLemma,
              sourceLang: dto.sourceLang,
              targetLang: dto.targetLang,
              contentHash: hash,
            },
          },
          create: {
            lemma: cacheKeyLemma,
            sourceLang: dto.sourceLang,
            targetLang: dto.targetLang,
            translation,
            grammarNote,
            partOfSpeech,
            modelVersion: client ? model : 'offline',
            contentHash: hash,
          },
          update: {
            translation,
            grammarNote,
            partOfSpeech,
            modelVersion: client ? model : 'offline',
          },
        });
      } catch {
        // Race or transient DB error — memory cache still serves the hit path.
      }
    }

    // Admin cost metrics + user daily quota: only count real OpenAI spend.
    if (usedOpenAi) {
      await this.incrementUsage(userId, today, 'lookupCount', memoryKey);
    }

    return { lemma, translation, grammarNote, partOfSpeech, cached: false };
  }

  async generateQuiz(
    segmentText: string,
    practiceType: PracticeType,
  ): Promise<
    Array<{
      prompt: string;
      options?: string[];
      correctAnswer: string;
      explanation?: string;
    }>
  > {
    if (!segmentText.trim()) return [];

    const settings = await this.getPlatformAiSettings();
    await this.assertAiAvailable(settings);

    const client = this.getClient();
    if (!client) {
      return [
        {
          prompt: 'What is the main topic of the passage?',
          options: ['Daily life', 'Travel', 'Science', 'History'],
          correctAnswer: 'Daily life',
          explanation:
            'Demo question — set OPENAI_API_KEY in .env and restart the API for AI-generated quizzes.',
        },
      ];
    }

    const model = settings.quizModel;
    const typeHint =
      practiceType === PracticeType.cloze
        ? 'Create 5 cloze-fill questions with single-word answers.'
        : 'Create 5 multiple-choice comprehension questions with 4 options each.';

    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Return JSON: {"questions":[{"prompt":"","options":["",""],"correctAnswer":"","explanation":""}]}',
          },
          {
            role: 'user',
            content: `${typeHint}\n\nPassage:\n${segmentText.slice(0, 4000)}`,
          },
        ],
      });

      try {
        const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}');
        return parsed.questions ?? [];
      } catch {
        return [];
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'OpenAI request failed';
      throw new ServiceUnavailableException(
        `AI quiz generation failed: ${detail}. Check OPENAI_API_KEY and model settings.`,
      );
    }
  }
}
