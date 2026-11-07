import { createHash } from 'crypto';
import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { PracticeType, Prisma } from '@prisma/client';
import { MASHQ_BURST_FALLBACKS, MASHQ_BURST_KEYS, uzOrthography } from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from '../../services/limits.service';
import { capOf, getPlanCaps, usageDayStart, userCapPlan } from '../../common/plan-caps';
import { AiService } from '../ai/ai.service';
import { foldSpace, PAGE_QUIZ_MIN, readingPassage, type PageBankItem } from '../ai/quiz-grounding';
import { canReadUserImport } from '../content/user-import-privacy';
import { catalogAccessGranted, paidCatalogIds, requiresCatalogPayment } from '../content/catalog-access';
import { redactSession } from './practice-redact';
import { shuffleAnswerOptions } from './shuffle-options';
import { StartPracticeDto } from './dto/practice.dto';

const MIN_WORDS = 60;
const MAX_PER_SESSION = 20;
/** How long a start request waits before telling the client to poll. Generation keeps running. */
const BANK_WAIT_MS = 2_500;
const GAVE_UP_MS = 60_000;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type Lang = 'en' | 'uz' | 'ru';
type LangText = Record<Lang, string>;
type LangOpts = Record<Lang, string[]>;

export function quizEmptyException() {
  const messages = {
    en: 'Every question on this page has been used.',
    uz: 'Bu sahifadagi savollar tugadi.',
    ru: 'Вопросы по этой странице закончились.',
  };
  return new ServiceUnavailableException({ statusCode: 503, code: 'quiz_empty', message: messages.en, messages });
}

/** The model did not return a bank. The screen stays up and the reader can try again. */
export function quizTryAgainException() {
  const messages = {
    en: 'Questions are not ready yet. Please try again in a moment.',
    uz: 'Savollar hozir tayyor emas. Birozdan keyin qayta urinib koʻring.',
    ru: 'Вопросы пока не готовы. Попробуйте ещё раз через минуту.',
  };
  return new ServiceUnavailableException({ statusCode: 503, code: 'quiz_unavailable', message: messages.en, messages });
}

/** A page with fewer than five stored questions is filled from the model, then saved. */
export function mashqNeedsLive(bankSize: number): boolean {
  return bankSize < PAGE_QUIZ_MIN;
}

const PENDING_MESSAGES: LangText = {
  en: 'Preparing questions…',
  uz: 'Savollar tayyorlanmoqda…',
  ru: 'Вопросы готовятся…',
};

/** Returned while the page bank is still being written. 202, no quota charge. */
export function quizPendingBody() {
  return { statusCode: 202, code: 'quiz_pending' as const, state: 'pending' as const, message: PENDING_MESSAGES.en, messages: PENDING_MESSAGES };
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

@Injectable()
export class MashqService {
  /** One generation per page hash, shared by the start that kicked it off and later polls. */
  private readonly generating = new Map<string, Promise<number>>();
  /** Finished with nothing to store. Short-lived so a later start can try again. */
  private readonly gaveUp = new Map<string, number>();

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
    const passage = readingPassage(segment.plainText);
    const hash = this.hash(passage);
    const live = await this.isUserImport(segment.contentId);
    const [unseenCount, missedToday, bankSize, remaining] = await Promise.all([
      this.countUnseen(userId, segment.id, hash),
      this.prisma.pageQuestionSeen.count({
        where: {
          userId,
          correct: false,
          seenAt: { gte: usageDayStart() },
          question: { segmentId: segment.id, status: 'active' },
        },
      }),
      this.bankCount(segment.id, hash),
      this.remaining(userId),
    ]);
    const key = `${segment.id}:${hash}`;
    const state = this.bankState(bankSize, unseenCount, missedToday, key, live);
    return {
      state,
      unseenCount,
      missedToday,
      remaining,
      maxPerSession: MAX_PER_SESSION,
    };
  }

  /** Catalog banks are ready or empty. Only a user import with nothing stored is pending. */
  private bankState(bankSize: number, unseenCount: number, missedToday: number, key: string, live: boolean) {
    if (bankSize > 0) {
      return unseenCount === 0 && missedToday === 0 ? 'empty' as const : 'ready' as const;
    }
    if (!live) return 'empty' as const;
    if (this.generating.has(key)) return 'pending' as const;
    const gave = this.gaveUp.get(key);
    if (gave && Date.now() - gave < GAVE_UP_MS) return 'empty' as const;
    return 'pending' as const;
  }

  async start(userId: string, dto: StartPracticeDto) {
    const loaded = await this.segmentForStart(userId, dto);
    if (loaded.wordCount < MIN_WORDS) throw new BadRequestException('This page is too short for Mashq');
    const segment = { ...loaded, plainText: readingPassage(loaded.plainText) };

    if (dto.idempotencyKey) {
      await this.sweepIdempotencyKeys();
      const existing = await this.findIdempotent(userId, dto);
      if (existing) return existing;
    }

    const count = Math.min(MAX_PER_SESSION, Math.max(3, dto.count ?? 5));
    await this.assertBurst(userId, count);
    await this.closeOldestOpen(userId);

    if (dto.repeatMissed) return this.repeatMissed(userId, segment, dto, count);

    const hash = this.hash(segment.plainText);
    const bank = await this.bankCount(segment.id, hash);
    let picked = await this.unseen(userId, segment.id, hash, count);
    if (mashqNeedsLive(bank)) {
      const phase = await this.awaitBank(userId, segment, hash);
      if (phase === 'pending') return quizPendingBody();
      picked = await this.unseen(userId, segment.id, hash, count);
    }
    if (!picked.length) {
      const gave = this.gaveUp.get(`${segment.id}:${hash}`);
      if (gave && Date.now() - gave < GAVE_UP_MS) throw quizTryAgainException();
      throw quizEmptyException();
    }

    // Count the allowance only for questions we are about to serve.
    let held = 0;
    try {
      held = await this.limits.reserveMashq(userId, picked.length);
      const slice = picked.slice(0, held);
      if (!slice.length) throw quizEmptyException();
      const session = await this.serve(userId, segment, slice, dto, false);
      const served = session.questions?.length ?? slice.length;
      if (held > served) await this.limits.releaseMashq(userId, held - served);
      held = 0;
      return session;
    } catch (e) {
      if (held > 0) await this.limits.releaseMashq(userId, held);
      throw e;
    }
  }

  /** Wait briefly for a bank. A slow model keeps running and the client polls. */
  private async awaitBank(
    userId: string,
    segment: { id: string; contentId: string; plainText: string },
    hash: string,
  ): Promise<'ready' | 'empty' | 'pending'> {
    const key = `${segment.id}:${hash}`;
    const existing = await this.bankCount(segment.id, hash);
    if (!mashqNeedsLive(existing)) return 'ready';
    const gave = this.gaveUp.get(key);
    if (gave && Date.now() - gave < GAVE_UP_MS) return 'empty';
    const job = this.kickGeneration(userId, segment, hash, key);
    return Promise.race([
      job.then((n) => (n > 0 ? 'ready' as const : 'empty' as const)),
      new Promise<'pending'>((resolve) => setTimeout(() => resolve('pending'), BANK_WAIT_MS)),
    ]);
  }

  private kickGeneration(
    userId: string,
    segment: { id: string; contentId: string; plainText: string },
    hash: string,
    key: string,
  ): Promise<number> {
    const current = this.generating.get(key);
    if (current) return current;
    const job = this.fillBank(userId, segment, hash)
      .then((n) => {
        if (n > 0) this.gaveUp.delete(key);
        else this.gaveUp.set(key, Date.now());
        return n;
      })
      .finally(() => {
        if (this.generating.get(key) === job) this.generating.delete(key);
      });
    this.generating.set(key, job);
    return job;
  }

  /** Generate until the page has at least five questions, then save them. A model failure is retried once. */
  private async fillBank(userId: string, segment: { id: string; contentId: string; plainText: string }, hash: string): Promise<number> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const have = await this.bankCount(segment.id, hash);
      if (!mashqNeedsLive(have)) return have;
      try {
        const used = await this.prisma.pageQuestion.findMany({
          where: { segmentId: segment.id, status: 'active' },
          select: { evidenceQuote: true },
        });
        const items = await this.ai.generatePageQuiz(segment.plainText, userId, used.map((row) => row.evidenceQuote));
        if (items.length) await this.storeItems(segment, hash, items);
      } catch {
        /* try the second pass; a hard failure still ends as empty rather than a false "used up" */
      }
    }
    return this.prisma.pageQuestion.count({
      where: { segmentId: segment.id, status: 'active', segmentHash: hash },
    });
  }

  private async repeatMissed(
    userId: string,
    segment: { id: string; contentId: string; plainText: string },
    dto: StartPracticeDto,
    count: number,
  ) {
    const rows = await this.prisma.pageQuestionSeen.findMany({
      where: {
        userId,
        correct: false,
        seenAt: { gte: usageDayStart() },
        question: { segmentId: segment.id, status: 'active' },
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
      const fix = (value: string) => (lang === 'uz' ? uzOrthography(value) : value);
      const options = pickOpts(optionsBag, lang).map(fix);
      const served = shuffleAnswerOptions(options, q.answerIndex);
      return {
        pageQuestionId: q.id,
        prompt: fix(pickText(promptBag, lang)),
        options: served.options,
        correctAnswer: fix(served.correctAnswer.trim()),
        explanation: fix(pickText(explanationBag, lang)),
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
            requestHash: dto.idempotencyKey ? this.requestHash(segment.id, dto.count ?? 5, Boolean(dto.repeatMissed)) : null,
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
        const existing = await this.findIdempotent(userId, dto);
        if (existing) return existing;
      }
      throw e;
    }
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
          promptI18n: { ...item.prompt, uz: uzOrthography(item.prompt.uz) },
          optionsI18n: {
            ...item.options,
            uz: item.options.uz.map((option) => uzOrthography(option)),
          },
          answerIndex: item.answerIndex,
          evidenceQuote: item.evidenceQuote,
          evidenceStart: Math.max(0, at),
          evidenceEnd: at < 0 ? 0 : at + quote.length,
          explanationI18n: { ...item.explanation, uz: uzOrthography(item.explanation.uz) },
          generatorVersion: 'live',
          status: 'active',
        },
      });
      have.add(quote);
    }
    const ready = await this.bankCount(segment.id, hash);
    await this.prisma.contentSegment.update({ where: { id: segment.id }, data: { quizReadyCount: ready } });
  }

  /** Paid rows were hashed from the raw page, while reads hash the folded passage. Serve either. */
  private async unseen(userId: string, segmentId: string, hash: string, take: number) {
    const matched = await this.pickUnseen(userId, segmentId, hash, take, true);
    if (matched.length) return matched;
    return this.pickUnseen(userId, segmentId, hash, take, false);
  }

  private async pickUnseen(userId: string, segmentId: string, hash: string, take: number, hashed: boolean) {
    const seen = await this.prisma.pageQuestionSeen.findMany({
      where: { userId, question: { segmentId, status: 'active', ...(hashed ? { segmentHash: hash } : {}) } },
      select: { questionId: true },
    });
    return this.prisma.pageQuestion.findMany({
      where: {
        segmentId,
        status: 'active',
        ...(hashed ? { segmentHash: hash } : {}),
        ...(seen.length ? { id: { notIn: seen.map((row) => row.questionId) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take,
    });
  }

  private async countUnseen(userId: string, segmentId: string, hash: string) {
    const matched = await this.prisma.pageQuestion.count({
      where: { segmentId, status: 'active', segmentHash: hash, seen: { none: { userId } } },
    });
    if (matched > 0) return matched;
    return this.prisma.pageQuestion.count({
      where: { segmentId, status: 'active', seen: { none: { userId } } },
    });
  }

  private async bankCount(segmentId: string, hash: string) {
    const matched = await this.prisma.pageQuestion.count({
      where: { segmentId, status: 'active', segmentHash: hash },
    });
    if (matched > 0) return matched;
    return this.prisma.pageQuestion.count({ where: { segmentId, status: 'active' } });
  }

  private async isUserImport(contentId: string): Promise<boolean> {
    const item = await this.prisma.contentItem.findUnique({
      where: { id: contentId },
      select: { contentSource: true, contentType: true },
    });
    return item?.contentSource === 'user_import' || item?.contentType === 'user_import';
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

  private requestHash(segmentId: string, count: number, repeatMissed: boolean) {
    return createHash('sha256').update(`${segmentId}|${count}|${repeatMissed ? 1 : 0}`).digest('hex');
  }

  private sweptKeysAt = 0;
  private async sweepIdempotencyKeys() {
    if (Date.now() - this.sweptKeysAt < IDEMPOTENCY_TTL_MS) return;
    this.sweptKeysAt = Date.now();
    await this.prisma.practiceSession.updateMany({
      where: { idempotencyKey: { not: null }, startedAt: { lt: new Date(Date.now() - IDEMPOTENCY_TTL_MS) } },
      data: { idempotencyKey: null },
    }).catch(() => undefined);
  }

  private async findIdempotent(userId: string, dto: StartPracticeDto) {
    const key = dto.idempotencyKey;
    if (!key) return null;
    const session = await this.prisma.practiceSession.findFirst({
      where: { userId, idempotencyKey: key },
      include: { questions: { orderBy: { questionIndex: 'asc' } } },
    });
    if (!session) return null;
    if (session.startedAt.getTime() <= Date.now() - IDEMPOTENCY_TTL_MS) {
      await this.prisma.practiceSession.update({ where: { id: session.id }, data: { idempotencyKey: null } });
      return null;
    }
    const hash = this.requestHash(session.segmentId ?? dto.segmentId ?? '', dto.count ?? 5, Boolean(dto.repeatMissed));
    if (session.requestHash && session.requestHash !== hash) {
      throw new UnprocessableEntityException({ message: 'This idempotency key was already used for a different request.', code: 'idempotency_mismatch' });
    }
    return redactSession(session);
  }

  private hash(text: string) {
    return createHash('sha256').update(text).digest('hex');
  }

  /** Page-bank questions are written from this page's own text, not the chapter around it. */
  private async segmentForStart(userId: string, dto: StartPracticeDto) {
    if (dto.source === 'page_bank' && (dto.page == null || dto.page < 1)) {
      throw new BadRequestException('page required');
    }
    if (dto.page != null && dto.contentId) {
      const row = await this.prisma.contentSegment.findFirst({
        where: {
          contentId: dto.contentId,
          pageIndex: dto.page - 1,
          ...(dto.chapterIndex != null ? { chapterIndex: dto.chapterIndex } : {}),
        },
        orderBy: { segmentIndex: 'asc' },
      });
      if (!row) throw new BadRequestException('Page not found');
      return this.loadSegment(userId, row.id);
    }
    if (!dto.segmentId) throw new BadRequestException('segmentId required');
    return this.loadSegment(userId, dto.segmentId);
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
