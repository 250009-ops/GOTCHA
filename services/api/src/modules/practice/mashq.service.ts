import { createHash } from 'crypto';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PracticeType, Prisma } from '@prisma/client';
import { MASHQ_BURST_FALLBACKS, MASHQ_BURST_KEYS } from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from '../../services/limits.service';
import { capOf, getPlanCaps, usageDayStart, userCapPlan } from '../../common/plan-caps';
import { AiService } from '../ai/ai.service';
import { foldSpace, type PageBankItem } from '../ai/quiz-grounding';
import { canReadUserImport } from '../content/user-import-privacy';
import { catalogAccessGranted, paidCatalogIds, requiresCatalogPayment } from '../content/catalog-access';
import { redactSession } from './practice-redact';
import { StartPracticeDto } from './dto/practice.dto';

const MIN_WORDS = 60;
const MAX_PER_SESSION = 20;

type Lang = 'en' | 'uz' | 'ru';
type LangText = Record<Lang, string>;
type LangOpts = Record<Lang, string[]>;

export function quizEmptyException() {
  const messages = {
    en: "Couldn't build a quiz for this chapter. Try again.",
    uz: 'Bu bob uchun test tuzib boʻlmadi. Qayta urinib koʻring.',
    ru: 'Не удалось составить тест по этой главе. Попробуйте ещё раз.',
  };
  return new ServiceUnavailableException({ statusCode: 503, code: 'quiz_empty', message: messages.en, messages });
}

function burstException() {
  const messages = {
    en: 'That was a bit fast. Continue in a minute.',
    uz: 'Biroz tez ketdi. Bir daqiqadan soʻng davom eting.',
    ru: 'Слишком быстро. Продолжите через минуту.',
  };
  return new HttpException({ statusCode: 429, code: 'mashq_burst', message: messages.en, messages }, HttpStatus.TOO_MANY_REQUESTS);
}

function asLang(value: string | null | undefined): Lang {
  return value === 'ru' || value === 'uz' ? value : 'en';
}

function pickText(bag: LangText, lang: Lang): string {
  return (bag[lang] || bag.en || '').trim();
}

function pickOpts(bag: LangOpts, lang: Lang): string[] {
  const list = bag[lang]?.length === 4 ? bag[lang] : bag.en;
  return (list ?? []).map((item) => String(item).trim());
}

function shuffle(options: string[]): string[] {
  const arr = [...options];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

@Injectable()
export class MashqService {
  constructor(
    private prisma: PrismaService,
    private ai: AiService,
    private limits: LimitsService,
  ) {}

  async bankStatus(userId: string, segmentId: string) {
    const segment = await this.loadSegment(userId, segmentId);
    if (segment.wordCount < MIN_WORDS) {
      return { state: 'none' as const, unseenCount: 0, missedToday: 0, remaining: null, maxPerSession: MAX_PER_SESSION };
    }
    const hash = this.hash(segment.plainText);
    const [unseenCount, missedToday, remaining] = await Promise.all([
      this.countUnseen(userId, segment.id, hash),
      this.prisma.pageQuestionSeen.count({
        where: {
          userId,
          correct: false,
          seenAt: { gte: usageDayStart() },
          question: { segmentId: segment.id, status: 'active', segmentHash: hash },
        },
      }),
      this.remaining(userId),
    ]);
    return {
      state: 'ready' as const,
      unseenCount,
      missedToday,
      remaining,
      maxPerSession: MAX_PER_SESSION,
    };
  }

  async start(userId: string, dto: StartPracticeDto) {
    if (!dto.segmentId) throw new BadRequestException('segmentId required');
    const segment = await this.loadSegment(userId, dto.segmentId);
    if (segment.wordCount < MIN_WORDS) throw new BadRequestException('This page is too short for Mashq');

    if (dto.idempotencyKey) {
      const existing = await this.findIdempotent(userId, dto.idempotencyKey);
      if (existing) return existing;
    }

    const count = Math.min(MAX_PER_SESSION, Math.max(3, dto.count ?? 5));
    await this.assertBurst(userId, count);
    await this.closeOldestOpen(userId);

    if (dto.repeatMissed) return this.repeatMissed(userId, segment, dto, count);

    let held = 0;
    try {
      held = await this.limits.reserveMashq(userId, count);
      const picked = await this.ensureAndPick(userId, segment, held);
      const extra = held - picked.length;
      if (extra > 0) {
        await this.limits.releaseMashq(userId, extra);
        held = picked.length;
      }
      if (!picked.length) throw quizEmptyException();
      const session = await this.serve(userId, segment, picked, dto, false);
      held = 0;
      return session;
    } catch (e) {
      if (held > 0) await this.limits.releaseMashq(userId, held);
      throw e;
    }
  }

  private async repeatMissed(
    userId: string,
    segment: { id: string; contentId: string; plainText: string },
    dto: StartPracticeDto,
    count: number,
  ) {
    const hash = this.hash(segment.plainText);
    const rows = await this.prisma.pageQuestionSeen.findMany({
      where: {
        userId,
        correct: false,
        seenAt: { gte: usageDayStart() },
        question: { segmentId: segment.id, status: 'active', segmentHash: hash },
      },
      include: { question: true },
      take: count,
    });
    if (!rows.length) throw new BadRequestException('No missed questions to repeat today');
    return this.serve(userId, segment, rows.map((row) => row.question), dto, true);
  }

  private async serve(
    userId: string,
    segment: { id: string; contentId: string },
    questions: Array<{ id: string; promptI18n: Prisma.JsonValue; optionsI18n: Prisma.JsonValue; answerIndex: number; explanationI18n: Prisma.JsonValue }>,
    dto: StartPracticeDto,
    repeat: boolean,
  ) {
    const lang = await this.questionLang(userId, segment.id);
    const built = questions.map((q) => {
      const optionsBag = q.optionsI18n as LangOpts;
      const promptBag = q.promptI18n as LangText;
      const explanationBag = q.explanationI18n as LangText;
      const options = pickOpts(optionsBag, lang);
      const answer = optionsBag[lang]?.[q.answerIndex] || optionsBag.en?.[q.answerIndex] || '';
      return {
        pageQuestionId: q.id,
        prompt: pickText(promptBag, lang),
        options: shuffle(options),
        correctAnswer: String(answer).trim(),
        explanation: pickText(explanationBag, lang),
      };
    }).filter((q) => q.prompt && q.correctAnswer && q.options.length === 4);

    if (!built.length) throw quizEmptyException();

    try {
      const session = await this.prisma.$transaction(async (tx) => {
        const created = await tx.practiceSession.create({
          data: {
            userId,
            contentId: dto.contentId ?? segment.contentId,
            segmentId: segment.id,
            practiceType: PracticeType.comprehension,
            questionCount: built.length,
            idempotencyKey: dto.idempotencyKey,
            questions: {
              create: built.map((q, idx) => ({
                questionIndex: idx,
                prompt: q.prompt,
                options: q.options,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation,
                pageQuestionId: q.pageQuestionId,
              })),
            },
          },
          include: { questions: { orderBy: { questionIndex: 'asc' } } },
        });
        if (!repeat) {
          for (const q of built) {
            await tx.pageQuestionSeen.upsert({
              where: { userId_questionId: { userId, questionId: q.pageQuestionId } },
              create: { userId, questionId: q.pageQuestionId },
              update: { seenAt: new Date(), correct: null },
            });
            await tx.pageQuestion.update({
              where: { id: q.pageQuestionId },
              data: { timesServed: { increment: 1 } },
            });
          }
        }
        return created;
      });
      return redactSession(session);
    } catch (e) {
      if (dto.idempotencyKey && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const existing = await this.findIdempotent(userId, dto.idempotencyKey);
        if (existing) return existing;
      }
      throw e;
    }
  }

  private async ensureAndPick(userId: string, segment: { id: string; contentId: string; plainText: string }, need: number) {
    const hash = this.hash(segment.plainText);
    await this.prisma.pageQuestion.updateMany({
      where: { segmentId: segment.id, status: 'active', segmentHash: { not: hash } },
      data: { status: 'retired' },
    });
    let picked = await this.unseen(userId, segment.id, hash, need);
    if (picked.length >= need) return picked;
    const items = await this.ai.generatePageQuiz(segment.plainText, userId);
    await this.storeItems(segment, hash, items);
    picked = await this.unseen(userId, segment.id, hash, need);
    return picked;
  }

  private async storeItems(segment: { id: string; contentId: string; plainText: string }, hash: string, items: PageBankItem[]) {
    const existing = await this.prisma.pageQuestion.findMany({
      where: { segmentId: segment.id, status: 'active', segmentHash: hash },
      select: { evidenceQuote: true },
    });
    const have = new Set(existing.map((row) => foldSpace(row.evidenceQuote)));
    const plain = foldSpace(segment.plainText);
    for (const item of items) {
      const quote = foldSpace(item.evidenceQuote);
      if (have.has(quote)) continue;
      const at = plain.toLowerCase().indexOf(quote.toLowerCase());
      await this.prisma.pageQuestion.create({
        data: {
          segmentId: segment.id,
          contentId: segment.contentId,
          segmentHash: hash,
          promptI18n: item.prompt,
          optionsI18n: item.options,
          answerIndex: item.answerIndex,
          evidenceQuote: item.evidenceQuote,
          evidenceStart: Math.max(0, at),
          evidenceEnd: at < 0 ? 0 : at + quote.length,
          explanationI18n: item.explanation,
          status: 'active',
        },
      });
      have.add(quote);
    }
    const ready = await this.prisma.pageQuestion.count({
      where: { segmentId: segment.id, status: 'active', segmentHash: hash },
    });
    await this.prisma.contentSegment.update({ where: { id: segment.id }, data: { quizReadyCount: ready } });
  }

  private unseen(userId: string, segmentId: string, hash: string, take: number) {
    return this.prisma.pageQuestionSeen.findMany({
      where: { userId, question: { segmentId, status: 'active', segmentHash: hash } },
      select: { questionId: true },
    }).then((seen) => this.prisma.pageQuestion.findMany({
      where: {
        segmentId,
        status: 'active',
        segmentHash: hash,
        ...(seen.length ? { id: { notIn: seen.map((row) => row.questionId) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take,
    }));
  }

  private countUnseen(userId: string, segmentId: string, hash: string) {
    return this.prisma.pageQuestion.count({
      where: {
        segmentId,
        status: 'active',
        segmentHash: hash,
        seen: { none: { userId } },
      },
    });
  }

  private async remaining(userId: string): Promise<number | null> {
    const [caps, plan] = await Promise.all([getPlanCaps(this.prisma), userCapPlan(this.prisma, userId)]);
    const cap = capOf(caps, plan, 'mashq');
    if (cap == null) return null;
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_usageDate: { userId, usageDate: usageDayStart() } },
    });
    return Math.max(0, cap - (usage?.mashqQuestionCount ?? 0));
  }

  private async assertBurst(userId: string, n: number) {
    const caps = await this.burstCaps();
    const now = Date.now();
    const [minute, hour] = await Promise.all([
      this.prisma.pageQuestionSeen.count({ where: { userId, seenAt: { gte: new Date(now - 60_000) } } }),
      this.prisma.pageQuestionSeen.count({ where: { userId, seenAt: { gte: new Date(now - 3_600_000) } } }),
    ]);
    if (minute + n > caps.perMinute || hour + n > caps.perHour) throw burstException();
  }

  private async burstCaps() {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: [MASHQ_BURST_KEYS.perMinute, MASHQ_BURST_KEYS.perHour, MASHQ_BURST_KEYS.maxOpenSessions] } },
    }).catch(() => [] as Array<{ key: string; value: unknown }>);
    const v = (key: string, fallback: number) => {
      const n = Number(rows.find((row) => row.key === key)?.value);
      return Number.isInteger(n) && n > 0 ? n : fallback;
    };
    return {
      perMinute: v(MASHQ_BURST_KEYS.perMinute, MASHQ_BURST_FALLBACKS.perMinute),
      perHour: v(MASHQ_BURST_KEYS.perHour, MASHQ_BURST_FALLBACKS.perHour),
      maxOpen: v(MASHQ_BURST_KEYS.maxOpenSessions, MASHQ_BURST_FALLBACKS.maxOpenSessions),
    };
  }

  private async closeOldestOpen(userId: string) {
    const { maxOpen } = await this.burstCaps();
    const open = await this.prisma.practiceSession.findMany({
      where: { userId, completedAt: null, questions: { some: { pageQuestionId: { not: null } } } },
      orderBy: { startedAt: 'asc' },
      select: { id: true },
    });
    if (open.length < maxOpen) return;
    const ids = open.slice(0, open.length - maxOpen + 1).map((row) => row.id);
    await this.prisma.practiceSession.updateMany({
      where: { id: { in: ids } },
      data: { completedAt: new Date() },
    });
  }

  private async questionLang(userId: string, segmentId: string): Promise<Lang> {
    const [user, segment] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { nativeLanguage: true, uiLanguage: true } }),
      this.prisma.contentSegment.findUnique({ where: { id: segmentId }, include: { content: { select: { language: true } } } }),
    ]);
    const passage = segment?.content.language ?? '';
    const native = user?.nativeLanguage?.trim();
    const ui = user?.uiLanguage?.trim();
    const chosen = native && native !== passage ? native : ui && ui !== passage ? ui : ui ?? native ?? 'uz';
    return asLang(chosen);
  }

  private findIdempotent(userId: string, key: string) {
    return this.prisma.practiceSession.findFirst({
      where: { userId, idempotencyKey: key },
      include: { questions: { orderBy: { questionIndex: 'asc' } } },
    }).then((session) => (session ? redactSession(session) : null));
  }

  private hash(text: string) {
    return createHash('sha256').update(text).digest('hex');
  }

  private async loadSegment(userId: string, segmentId: string) {
    const segment = await this.prisma.contentSegment.findUnique({ where: { id: segmentId } });
    if (!segment) throw new NotFoundException('Segment not found');
    const item = await this.prisma.contentItem.findUnique({ where: { id: segment.contentId } });
    if (!item || !canReadUserImport(item, userId)) throw new NotFoundException('Segment not found');
    if (requiresCatalogPayment(item)) {
      const purchasedIds = await paidCatalogIds(this.prisma, userId, [item.id]);
      if (!catalogAccessGranted({ item, userId, purchasedIds })) {
        throw new ForbiddenException('Payment required to read this book');
      }
    }
    return segment;
  }
}
