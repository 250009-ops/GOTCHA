import { Injectable, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import OpenAI from 'openai';
import { PracticeType, AppLanguage } from '@prisma/client';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import { PrismaService } from '../../prisma/prisma.service';
import { LookupDto } from './dto/ai.dto';

type MemoryLookup = {
  translation: string;
  grammarNote: string | null;
  partOfSpeech: string | null;
};

@Injectable()
export class AiService {
  private client: OpenAI | null = null;
  private readonly memoryCache = new Map<string, MemoryLookup>();
  private readonly memoryUsage = new Map<string, number>();

  constructor(private prisma: PrismaService) {}

  private useMemory() {
    return isDevAuthEnabled() && !this.prisma.dbAvailable;
  }

  private getClient() {
    if (!this.client) {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return null;
      this.client = new OpenAI({ apiKey: key });
    }
    return this.client;
  }

  private contentHash(text: string) {
    return createHash('sha256').update(text).digest('hex').slice(0, 32);
  }

  private async checkQuota(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (this.useMemory()) {
      const key = `${userId}:${today.toISOString().slice(0, 10)}`;
      const used = this.memoryUsage.get(key) ?? 0;
      const quota = 50;
      if (used >= quota) throw new ForbiddenException('Daily AI quota exceeded');
      return { quota, usage: { lookupCount: used }, today, memoryKey: key };
    }

    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    const quota = sub?.plan.aiDailyQuota ?? 50;

    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_usageDate: { userId, usageDate: today } },
    });

    // Values >= 1e6 match Premium "Unlimited AI lookups" from Landing pricing.
    if (quota < 1_000_000 && (usage?.lookupCount ?? 0) >= quota) {
      throw new ForbiddenException('Daily AI quota exceeded');
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
      return;
    }
    await this.prisma.aiUsageDaily.upsert({
      where: { userId_usageDate: { userId, usageDate: today } },
      create: { userId, usageDate: today, [field]: 1 },
      update: { [field]: { increment: 1 } },
    });
  }

  async lookup(userId: string, dto: LookupDto) {
    const { today, memoryKey } = await this.checkQuota(userId);
    const lemma = dto.token.toLowerCase();
    const hash = this.contentHash(`${lemma}|${dto.sentence}|${dto.sourceLang}|${dto.targetLang}`);

    if (this.useMemory()) {
      const cached = this.memoryCache.get(hash);
      if (cached) return { ...cached, lemma, cached: true };
    } else {
      const cached = await this.prisma.lemmaCache.findUnique({
        where: {
          lemma_sourceLang_targetLang_contentHash: {
            lemma,
            sourceLang: dto.sourceLang,
            targetLang: dto.targetLang,
            contentHash: hash,
          },
        },
      });

      if (cached) {
        return {
          lemma,
          translation: cached.translation,
          grammarNote: cached.grammarNote,
          partOfSpeech: cached.partOfSpeech,
          cached: true,
        };
      }
    }

    const client = this.getClient();
    let translation = `[${dto.token}]`;
    let grammarNote: string | null = null;
    let partOfSpeech: string | null = null;

    if (client) {
      const model = process.env.OPENAI_MODEL_LOOKUP ?? 'gpt-4.1-mini';
      const response = await client.chat.completions.create({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You are a language tutor. Return JSON: {"translation":"","grammarNote":"","partOfSpeech":""}. Be concise.',
          },
          {
            role: 'user',
            content: `Word: "${dto.token}"\nSentence: "${dto.sentence}"\nTranslate from ${dto.sourceLang} to ${dto.targetLang}.`,
          },
        ],
      });

      try {
        const parsed = JSON.parse(response.choices[0]?.message?.content ?? '{}');
        translation = parsed.translation ?? translation;
        grammarNote = parsed.grammarNote ?? null;
        partOfSpeech = parsed.partOfSpeech ?? null;
      } catch {
        translation = response.choices[0]?.message?.content ?? translation;
      }
    } else {
      // Offline / no API key — still return useful demo copy for the Reader panel.
      translation = `${dto.token} — contextual meaning in ${dto.targetLang}`;
      grammarNote = `Demo lookup for “${dto.token}” (set OPENAI_API_KEY for live AI).`;
      partOfSpeech = 'word';
    }

    if (this.useMemory()) {
      this.memoryCache.set(hash, { translation, grammarNote, partOfSpeech });
    } else {
      await this.prisma.lemmaCache.create({
        data: {
          lemma,
          sourceLang: dto.sourceLang,
          targetLang: dto.targetLang,
          translation,
          grammarNote,
          partOfSpeech,
          modelVersion: process.env.OPENAI_MODEL_LOOKUP ?? 'offline',
          contentHash: hash,
        },
      });
    }

    await this.incrementUsage(userId, today, 'lookupCount', memoryKey);

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

    const client = this.getClient();
    if (!client) {
      return [
        {
          prompt: 'What is the main topic of the passage?',
          options: ['Daily life', 'Travel', 'Science', 'History'],
          correctAnswer: 'Daily life',
          explanation: 'Demo question — configure OPENAI_API_KEY for AI-generated quizzes.',
        },
      ];
    }

    const model = process.env.OPENAI_MODEL_QUIZ ?? 'gpt-4.1-mini';
    const typeHint =
      practiceType === PracticeType.cloze
        ? 'Create 5 cloze-fill questions with single-word answers.'
        : 'Create 5 multiple-choice comprehension questions with 4 options each.';

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
  }
}
