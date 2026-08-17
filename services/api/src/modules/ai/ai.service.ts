import {
  Injectable,
  ForbiddenException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { PracticeType } from '@prisma/client';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { PrismaService } from '../../prisma/prisma.service';
import { LookupDto, TranslateDto } from './dto/ai.dto';
import {
  AiPlatformSettings,
  defaultAiPlatformSettings,
  parseAiPlatformSettings,
  resolveLearnerDailyAiQuota,
  AI_SETTING_KEYS,
} from './ai-settings';
import { ExtractedChapter } from '../imports/extract-text';
import {
  buildCleanupUserPrompt,
  CleanupChunkResult,
  IMPORT_CLEANUP_SYSTEM_PROMPT,
  importCleanupModel,
  isImportAiCleanupEnabled,
  mergeChapterCleanup,
  planImportCleanup,
  processCleanupChunk,
  ImportCleanupSource,
} from '../imports/import-ai-cleanup';
import {
  LOOKUP_CACHE_VERSION,
  LOOKUP_SYSTEM_PROMPT,
  classifyLookup,
  clampContext,
  displaySentenceHead,
  glossLimitsFor,
  lookupMaxTokens,
  lookupWordCount,
  looksLikeDefinitionGloss,
  normalizeLemmaKey,
  normalizeSentenceForHash,
  packLookupNote,
  sanitizeContextualMeaning,
  sanitizeGloss,
  sanitizePhrase,
  unpackLookupNote,
} from './lookup-normalize';

type MemoryLookup = {
  lemma: string;
  translation: string;
  contextualMeaning: string | null;
  phrase: string | null;
  grammarNote: string | null;
  partOfSpeech: string | null;
};

/** In-memory LRU size in front of DB (and for offline/dev). */
const MEMORY_LRU_MAX = 800;

/** Soft timeout for import cleanup calls (production imports must not hang forever). */
const IMPORT_CLEANUP_TIMEOUT_MS = 55_000;
const IMPORT_CLEANUP_MAX_RETRIES = 1;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
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
      if (settings.dailyLimit > 0 && this.memoryPlatformLookups >= settings.dailyLimit) {
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
    if (settings.dailyLimit > 0 && used >= settings.dailyLimit) {
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
      if (quota > 0 && quota < 1_000_000 && used >= quota) {
        throw new ForbiddenException(
          'Daily AI lookup limit reached. Try again tomorrow.',
        );
      }
      return { quota, usage: { lookupCount: used }, today, memoryKey: key };
    }

    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const quota = resolveLearnerDailyAiQuota(sub?.plan.aiDailyQuota, defaultUserQuota);

    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_usageDate: { userId, usageDate: today } },
    });

    // Values >= 1e6 match Premium "Unlimited AI lookups" from Landing pricing.
    if (quota > 0 && quota < 1_000_000 && (usage?.lookupCount ?? 0) >= quota) {
      throw new ForbiddenException(
        'Daily AI lookup limit reached. Try again tomorrow.',
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
    const kind = classifyLookup(surface, context);
    const { lemma: cacheKeyLemma, hash } = this.buildLookupCacheKey(dto, surface, context);

    const fromMemory = this.memoryGet(hash);
    if (fromMemory) {
      return this.presentLookup(fromMemory, surface, context, true);
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
        const unpacked = unpackLookupNote(cached.grammarNote);
        const limits = glossLimitsFor(kind);
        const payload: MemoryLookup = {
          lemma: cached.lemma || cacheKeyLemma,
          translation: sanitizeGloss(cached.translation, surface, limits, kind),
          contextualMeaning: sanitizeContextualMeaning(unpacked.contextualMeaning, cached.translation, kind),
          phrase: sanitizePhrase(unpacked.phrase, context, surface, kind),
          grammarNote: null,
          partOfSpeech: cached.partOfSpeech ?? null,
        };
        this.memorySet(hash, payload);
        return this.presentLookup(payload, surface, context, true);
      }
    }

    // Miss path only: enforce platform + user quota before spending OpenAI.
    const settings = await this.getPlatformAiSettings();
    await this.assertAiAvailable(settings);
    const { today, memoryKey } = await this.checkQuota(userId, settings.defaultUserQuota);

    const client = this.getClient();
    const limits = glossLimitsFor(kind);
    const surfaceWords = lookupWordCount(surface);
    let lemma = cacheKeyLemma;
    let translation = surface;
    let contextualMeaning: string | null = null;
    let phrase: string | null = kind === 'phrase' ? surface.trim() : null;
    const grammarNote: string | null = null;
    const partOfSpeech: string | null = null;
    const model = settings.lookupModel;
    let usedOpenAi = false;

    if (client) {
      try {
        const modeHint =
          kind === 'sentence'
            ? 'MODE=SENTENCE. Translate TARGET completely into GLOSS LANGUAGE. phraseIfAny = null. contextualMeaning = null. Do not summarize.'
            : kind === 'phrase'
              ? 'MODE=PHRASE. Gloss the selected phrase. translation = short dictionary gloss. contextualMeaning = in-sentence meaning. Do not translate the rest of SENTENCE.'
              : 'MODE=WORD. translation = dictionary/base gloss of TARGET (1–3 words, sense that fits SENTENCE). contextualMeaning = natural in-context meaning. If TARGET is inside an idiom, phraseIfAny MUST be that exact span copied from SENTENCE.';
        const response = await client.chat.completions.create({
          model,
          temperature: 0,
          max_tokens: lookupMaxTokens(kind, surface),
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: LOOKUP_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                `TARGET: "${surface}"`,
                dto.lemma && surfaceWords <= 2 ? `Lemma hint: "${dto.lemma}"` : null,
                `SENTENCE: "${context}"`,
                `GLOSS LANGUAGE: ${dto.targetLang}`,
                `SOURCE LANGUAGE: ${dto.sourceLang}`,
                modeHint,
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
            contextualMeaning?: string;
            phraseIfAny?: string | null;
          };
          phrase = sanitizePhrase(parsed.phraseIfAny, context, surface, kind)
            ?? (kind === 'phrase' ? surface.trim() : null);
          lemma = normalizeLemmaKey(parsed.lemma || phrase || cacheKeyLemma) || cacheKeyLemma;
          if (kind === 'sentence') {
            lemma = displaySentenceHead(surface);
            phrase = null;
          }
          translation = sanitizeGloss(parsed.translation, surface, limits, kind);
          contextualMeaning = sanitizeContextualMeaning(parsed.contextualMeaning, translation, kind);
        } catch {
          translation = sanitizeGloss(response.choices[0]?.message?.content, surface, limits, kind);
        }

        try {
          if (kind === 'word' && looksLikeDefinitionGloss(translation)) {
            const strict = await this.strictBaseGloss(client, model, surface, dto.targetLang);
            if (strict) translation = sanitizeGloss(strict, translation, limits, kind);
          }
        } catch {
          // Keep the first-pass gloss — never fail a successful lookup on the optional dictionary pass.
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

    translation = sanitizeGloss(translation, surface, limits, kind);
    phrase = sanitizePhrase(phrase, context, surface, kind)
      ?? (kind === 'phrase' ? surface.trim() : null);
    if (kind === 'sentence') {
      lemma = displaySentenceHead(surface);
      phrase = null;
      contextualMeaning = null;
    }
    const payload: MemoryLookup = {
      lemma,
      translation,
      contextualMeaning,
      phrase,
      grammarNote,
      partOfSpeech,
    };
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
            grammarNote: packLookupNote(contextualMeaning, phrase),
            partOfSpeech,
            modelVersion: client ? model : 'offline',
            contentHash: hash,
          },
          update: {
            translation,
            grammarNote: packLookupNote(contextualMeaning, phrase),
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

    return this.presentLookup(payload, surface, context, false);
  }

  /** Donish-style second pass: if the base gloss looks like a definition, ask for a short dictionary word. Fail-soft. */
  private async strictBaseGloss(
    client: OpenAI,
    model: string,
    word: string,
    glossLang: string,
  ): Promise<string | null> {
    try {
      const response = await client.chat.completions.create({
        model,
        temperature: 0,
        max_tokens: 60,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a bilingual dictionary. Return ONLY JSON: {"translation":""}. translation is the short base/dictionary gloss of ONE word in the requested language. No context phrases, no alternatives, no punctuation.',
          },
          {
            role: 'user',
            content: `Word: ${word}\nGLOSS LANGUAGE: ${glossLang}`,
          },
        ],
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as { translation?: string };
      const next = typeof parsed.translation === 'string' ? parsed.translation.trim() : '';
      return next || null;
    } catch {
      return null;
    }
  }

  private presentLookup(row: MemoryLookup, surface: string, context: string, cached: boolean) {
    const kind = classifyLookup(surface, context);
    const translation = sanitizeGloss(row.translation, surface, glossLimitsFor(kind), kind);
    const phrase = sanitizePhrase(row.phrase, context, surface, kind);
    return {
      lemma: kind === 'sentence' ? displaySentenceHead(surface) : row.lemma,
      translation,
      contextualMeaning: sanitizeContextualMeaning(row.contextualMeaning, translation, kind),
      phrase,
      grammarNote: row.grammarNote,
      partOfSpeech: row.partOfSpeech,
      kind,
      cached,
    };
  }

  /**
   * Sentence/message translation for chat From→To.
   * Does not consume the per-learner word-lookup quota (that cap is for tap lookups).
   * Still respects admin AI enabled + platform daily OpenAI budget.
   * Never logs raw message text.
   */
  async translate(userId: string, dto: TranslateDto) {
    const text = (dto.text ?? '').trim();
    if (!text) {
      return { translation: '', sourceLang: dto.sourceLang, targetLang: dto.targetLang, cached: true };
    }
    if (dto.sourceLang === dto.targetLang) {
      return { translation: text, sourceLang: dto.sourceLang, targetLang: dto.targetLang, cached: true };
    }

    const hash = this.contentHash(
      ['tr-v2', dto.sourceLang, dto.targetLang, this.sentenceHash(text)].join('|'),
    );
    const cached = this.memoryGet(hash);
    if (cached?.translation) {
      return {
        translation: cached.translation,
        sourceLang: dto.sourceLang,
        targetLang: dto.targetLang,
        cached: true,
      };
    }

    const settings = await this.getPlatformAiSettings();
    await this.assertAiAvailable(settings);
    const client = this.getClient();
    let translation = text;

    if (client) {
      try {
        const response = await client.chat.completions.create({
          model: settings.lookupModel,
          temperature: 0.1,
          max_tokens: Math.min(1200, Math.max(80, Math.ceil(text.length * 1.4))),
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'You are a precise translator for a language-learning chat. Return ONLY JSON: {"translation":""}. Translate the ENTIRE message into the target language. Keep every clause, meaning, and tone. Do not summarize, omit, add quotes, labels, or explanations. When source and target languages differ, you MUST rewrite the message into the target language — never return the source text unchanged.',
            },
            {
              role: 'user',
              content: `Source language: ${dto.sourceLang}\nTarget language: ${dto.targetLang}\nMessage:\n${text}`,
            },
          ],
        });
        try {
          const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}') as {
            translation?: string;
          };
          const next = typeof parsed.translation === 'string' ? parsed.translation.trim() : '';
          if (next) translation = next;
        } catch {
          const raw = response.choices[0]?.message?.content?.trim();
          if (raw) translation = raw;
        }
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'OpenAI request failed';
        throw new ServiceUnavailableException(
          `AI translate failed: ${detail}. Check OPENAI_API_KEY and model settings.`,
        );
      }
    }

    this.memorySet(hash, {
      lemma: hash,
      translation,
      contextualMeaning: null,
      phrase: null,
      grammarNote: null,
      partOfSpeech: null,
    });
    return { translation, sourceLang: dto.sourceLang, targetLang: dto.targetLang, cached: false };
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

  /**
   * Post-extract cleanup for URL/PDF/EPUB imports.
   * OpenAI only selects unnecessary parts; removal is applied locally to the deterministic extract.
   * Never throws to callers — on any failure returns the original chapters so live imports keep working.
   * Does not consume learner per-user AI quota (platform-side pipeline step).
   */
  async cleanImportChapters(
    chapters: ExtractedChapter[],
    opts: {
      source: ImportCleanupSource;
      documentTitle?: string;
      userId?: string;
    },
  ): Promise<ExtractedChapter[]> {
    if (!chapters.length || !isImportAiCleanupEnabled()) return chapters;

    const client = this.getClient();
    if (!client) {
      this.logger.debug('Import AI cleanup skipped — OPENAI_API_KEY not set');
      return chapters;
    }

    try {
      const settings = await this.getPlatformAiSettings();
      if (!settings.enabled) {
        this.logger.debug('Import AI cleanup skipped — AI disabled in platform settings');
        return chapters;
      }

      // Soft platform budget check (do not throw — fall back to deterministic extract).
      if (!(await this.softPlatformBudgetOk(settings))) {
        this.logger.warn('Import AI cleanup skipped — platform daily AI limit reached');
        return chapters;
      }

      // Platform setting (admin) wins; defaults already fall back to OPENAI_MODEL_IMPORT / LOOKUP.
      const model = settings.importCleanupModel || importCleanupModel();
      const plan = planImportCleanup(chapters);
      if (plan.length === 0) return chapters;

      const next = chapters.map((c) => ({ ...c }));
      let usedOpenAi = false;

      for (const item of plan) {
        const chunkResults: CleanupChunkResult[] = [];
        let chapterFailed = false;

        for (let ci = 0; ci < item.chunks.length; ci++) {
          const result = await this.cleanupImportChunkWithRetry(client, {
            model,
            source: opts.source,
            documentTitle: opts.documentTitle,
            chapterTitle: item.chapter.title,
            chunkIndex: ci,
            chunkTotal: item.chunks.length,
            text: item.chunks[ci],
          });

          if (!result) {
            chapterFailed = true;
            break;
          }
          usedOpenAi = true;
          chunkResults.push(result);
        }

        if (chapterFailed) continue;

        const merged = mergeChapterCleanup(
          item.chapter,
          chunkResults,
          item.chunks,
          item.remainder,
        );
        if (merged === null) {
          next[item.index] = { title: item.chapter.title, text: '' };
        } else {
          next[item.index] = merged;
        }
      }

      const cleaned = next.filter((c) => c.text.trim().length > 0);
      if (cleaned.length === 0) {
        this.logger.warn('Import AI cleanup produced empty document — keeping original extract');
        return chapters;
      }

      if (usedOpenAi && opts.userId) {
        await this.recordImportCleanupUsage(opts.userId).catch(() => undefined);
      }

      return cleaned;
    } catch (err) {
      this.logger.warn(
        `Import AI cleanup failed — using original extract: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return chapters;
    }
  }

  private async softPlatformBudgetOk(settings: AiPlatformSettings): Promise<boolean> {
    if (this.useMemory()) {
      return this.memoryPlatformLookups < settings.dailyLimit;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const agg = await this.prisma.aiUsageDaily.aggregate({
      where: { usageDate: today },
      _sum: { lookupCount: true, quizCount: true },
    });
    const used = (agg._sum.lookupCount ?? 0) + (agg._sum.quizCount ?? 0);
    return used < settings.dailyLimit;
  }

  private async recordImportCleanupUsage(userId: string) {
    if (this.useMemory()) {
      this.memoryPlatformLookups += 1;
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Reuse quizCount bucket for platform metrics (no schema migration).
    await this.prisma.aiUsageDaily.upsert({
      where: { userId_usageDate: { userId, usageDate: today } },
      create: { userId, usageDate: today, quizCount: 1 },
      update: { quizCount: { increment: 1 } },
    });
  }

  private async cleanupImportChunkWithRetry(
    client: OpenAI,
    opts: {
      model: string;
      source: ImportCleanupSource;
      documentTitle?: string;
      chapterTitle?: string;
      chunkIndex: number;
      chunkTotal: number;
      text: string;
    },
  ): Promise<CleanupChunkResult | null> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= IMPORT_CLEANUP_MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), IMPORT_CLEANUP_TIMEOUT_MS);
        try {
          const response = await client.chat.completions.create(
            {
              model: opts.model,
              temperature: 0,
              // Selection-only JSON (block indexes + optional snippets) — no rewritten body.
              max_tokens: 1024,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: IMPORT_CLEANUP_SYSTEM_PROMPT },
                {
                  role: 'user',
                  content: buildCleanupUserPrompt({
                    source: opts.source,
                    documentTitle: opts.documentTitle,
                    chapterTitle: opts.chapterTitle,
                    chunkIndex: opts.chunkIndex,
                    chunkTotal: opts.chunkTotal,
                    text: opts.text,
                  }),
                },
              ],
            },
            { signal: controller.signal },
          );
          const parsed = processCleanupChunk(
            opts.text,
            response.choices[0]?.message?.content,
          );
          if (parsed) return parsed;
          lastError = new Error('Invalid cleanup selection JSON');
        } finally {
          clearTimeout(timer);
        }
      } catch (err) {
        lastError = err;
      }
    }
    this.logger.warn(
      `Import cleanup chunk failed after retries: ${
        lastError instanceof Error ? lastError.message : lastError
      }`,
    );
    return null;
  }
}
