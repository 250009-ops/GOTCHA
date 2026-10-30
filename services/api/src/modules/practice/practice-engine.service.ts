import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PracticeType, type Prisma, type UserVocabulary } from '@prisma/client';
import {
  DEFAULT_DAILY_GOAL_XP,
  XP_RULES,
  buildCloze,
  chooseExerciseType,
  displayStreak,
  gradeAnswer,
  hashString,
  normalize,
  outcomeToRating,
  seededRandom,
  sessionBonusXp,
  shuffle,
  streakOnGoalMet,
  xpForAnswer,
  type ExerciseType,
  type GradeResult,
} from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { VocabularyService } from '../vocabulary/vocabulary.service';
import { AiService } from '../ai/ai.service';
import { calendarDateKey, dateFromCalendarKey, diffCalendarDays } from '../../services/streak.service';
import { buildPracticeItem, type PracticeItem } from './practice-items';
export type { PracticeItem } from './practice-items';
import type { AnswerExerciseDto, DailySessionQueryDto } from './dto/practice-engine.dto';

type VocabRow = UserVocabulary & { content?: { id: string; title: string } | null };

const MCQ_TYPES: ExerciseType[] = ['mcq_meaning', 'cloze_mcq', 'listening_mcq'];

@Injectable()
export class PracticeEngineService {
  constructor(
    private prisma: PrismaService,
    private vocabulary: VocabularyService,
    private ai: AiService,
  ) {}

  // ---------------------------------------------------------------- overview

  private async todayStats(userId: string) {
    const [user, prefs] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { xpTotal: true, xpToday: true, xpDate: true, streakCount: true, streakLastDate: true, bestStreak: true, streakFreezes: true },
      }),
      this.prisma.userPreferences.findUnique({ where: { userId }, select: { dailyGoalXp: true, dailyNewWords: true } }),
    ]);
    const now = new Date();
    const xpToday = user?.xpDate && calendarDateKey(user.xpDate, 'UTC') === calendarDateKey(now) ? user.xpToday : 0;
    const gap = user?.streakLastDate ? diffCalendarDays(user.streakLastDate, now) : null;
    return {
      user,
      xpToday,
      xpTotal: user?.xpTotal ?? 0,
      dailyGoalXp: prefs?.dailyGoalXp ?? DEFAULT_DAILY_GOAL_XP,
      dailyNewWords: prefs?.dailyNewWords ?? 10,
      streakCount: displayStreak(user?.streakCount ?? 0, user?.streakFreezes ?? 0, gap),
      bestStreak: user?.bestStreak ?? 0,
      streakFreezes: user?.streakFreezes ?? 0,
      practicedToday: gap === 0,
    };
  }

  async forecast(userId: string, lang?: string) {
    const now = new Date();
    const end = new Date(now.getTime() + 8 * 86_400_000);
    const rows = await this.prisma.userVocabulary.findMany({
      where: { userId, ...(lang ? { sourceLang: lang as UserVocabulary['sourceLang'] } : {}), dueAt: { gt: now, lte: end }, fsrsState: { not: 0 } },
      select: { dueAt: true },
    });
    const today = calendarDateKey(now);
    return Array.from({ length: 7 }, (_, i) => {
      const key = calendarDateKey(new Date(now.getTime() + (i + 1) * 86_400_000));
      return { date: key, count: rows.filter((r) => calendarDateKey(r.dueAt) === key || (i === 0 && calendarDateKey(r.dueAt) === today)).length };
    });
  }

  async overview(userId: string, lang?: string) {
    const now = new Date();
    const lw = lang ? { sourceLang: lang as UserVocabulary['sourceLang'] } : {};
    const [due, fresh, total, known, stats, forecast, skill] = await Promise.all([
      this.prisma.userVocabulary.count({ where: { userId, ...lw, fsrsState: { not: 0 }, dueAt: { lte: now } } }),
      this.prisma.userVocabulary.count({ where: { userId, ...lw, fsrsState: 0 } }),
      this.prisma.userVocabulary.count({ where: { userId, ...lw } }),
      this.prisma.userVocabulary.count({ where: { userId, ...lw, mastered: true } }),
      this.todayStats(userId),
      this.forecast(userId, lang),
      this.recentSkill(userId, 50),
    ]);
    const { user: _u, ...rest } = stats;
    return { dueCount: due, newCount: fresh, totalWords: total, masteredWords: known, accuracy: round2(skill), forecast, ...rest };
  }

  /** Rolling accuracy over the last N graded items (non-flashcard); 0.85 when there is little history. */
  private async recentSkill(userId: string, n = 10): Promise<number> {
    const rows = await this.prisma.vocabularyReview.findMany({
      where: { vocab: { userId }, correct: { not: null } },
      orderBy: { reviewedAt: 'desc' },
      take: n,
      select: { correct: true },
    });
    if (rows.length < Math.min(5, n)) return 0.85;
    return rows.filter((r) => r.correct).length / rows.length;
  }

  // ---------------------------------------------------------------- session

  async dailySession(userId: string, q: DailySessionQueryDto) {
    const size = q.size ?? 15;
    const now = new Date();
    const caps = new Set((q.caps ?? '').split(',').map((c) => c.trim()));
    const lw = q.lang ? { sourceLang: q.lang as UserVocabulary['sourceLang'] } : {};
    const include = { content: { select: { id: true, title: true } } } as const;
    const focusIds = (q.focus ?? '').split(',').map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s)).slice(0, 30);
    const wantExtra = q.extra === '1' || q.extra === 'true';
    const stats = await this.todayStats(userId);

    let picked: Array<{ v: VocabRow; extra: boolean }> = [];
    if (focusIds.length) {
      const rows = await this.prisma.userVocabulary.findMany({ where: { userId, id: { in: focusIds } }, include });
      picked = rows.map((v) => ({ v, extra: v.fsrsState !== 0 && v.dueAt > now }));
    } else {
      // 1) due reviews, oldest overdue first, capped at 80% of the session
      const dueRows = await this.prisma.userVocabulary.findMany({
        where: { userId, ...lw, fsrsState: { not: 0 }, dueAt: { lte: now } },
        orderBy: { dueAt: 'asc' },
        take: size,
        include,
      });
      // 2) new words up to today's remaining new-word allowance
      const introducedToday = await this.prisma.vocabularyReview.count({
        where: { vocab: { userId }, intervalBefore: 0, reviewedAt: { gte: dateFromCalendarKey(calendarDateKey(now)) }, exerciseType: { not: null }, extra: false },
      });
      const newAllowance = Math.max(0, stats.dailyNewWords - introducedToday);
      const newRows = await this.prisma.userVocabulary.findMany({
        where: { userId, ...lw, fsrsState: 0 },
        orderBy: { createdAt: 'desc' },
        take: Math.min(size, newAllowance),
        include,
      });
      const reviewCap = newRows.length ? Math.ceil(size * 0.8) : size;
      picked = dueRows.slice(0, reviewCap).map((v) => ({ v, extra: false }));
      picked.push(...newRows.slice(0, size - picked.length).map((v) => ({ v, extra: false })));
      // 3) "All caught up" → extra practice only when asked (weakest first)
      if (!picked.length && wantExtra) {
        const extra = await this.prisma.userVocabulary.findMany({
          where: { userId, ...lw },
          orderBy: [{ stability: 'asc' }, { dueAt: 'asc' }],
          take: size,
          include,
        });
        picked = extra.map((v) => ({ v, extra: true }));
      }
    }

    if (!picked.length) {
      const total = await this.prisma.userVocabulary.count({ where: { userId, ...lw } });
      return { sessionId: null, items: [], caughtUp: total > 0, totalWords: total, ...this.publicStats(stats) };
    }

    const session = await this.prisma.practiceSession.create({
      data: { userId, practiceType: PracticeType.mixed, questionCount: picked.length },
      select: { id: true },
    });

    const skill = await this.recentSkill(userId, 10);
    const pool = await this.prisma.userVocabulary.findMany({
      where: { userId },
      select: { id: true, lemma: true, translation: true, sourceLang: true, targetLang: true },
      orderBy: { createdAt: 'desc' },
      take: 400,
    });
    const rand = seededRandom(hashString(session.id));
    const items: PracticeItem[] = [];
    const recent: ExerciseType[] = [];
    // Due cards first keep their order; interleave the new ones in.
    const ordered = interleave(picked.filter((p) => p.v.fsrsState !== 0), shuffle(picked.filter((p) => p.v.fsrsState === 0), rand));
    for (const { v, extra } of ordered) {
      const cloze = buildCloze(v.contextSentence, v.lemma);
      const meaningOpts = this.distractors(pool, v, 'translation', rand);
      const wordOpts = this.distractors(pool, v, 'lemma', rand);
      const type = chooseExerciseType(
        { state: v.fsrsState, stability: v.stability, lapses: v.lapses, clozeable: !!cloze, canMcq: meaningOpts.length >= 3 && wordOpts.length >= 3 },
        { listening: caps.has('listening') },
        skill,
        rand,
        recent,
      );
      recent.push(type);
      items.push(buildPracticeItem(v, type, extra, cloze, type === 'mcq_meaning' ? meaningOpts : wordOpts, rand));
    }
    return { sessionId: session.id, items, caughtUp: false, totalWords: pool.length, skill: round2(skill), ...this.publicStats(stats) };
  }

  private publicStats(s: Awaited<ReturnType<PracticeEngineService['todayStats']>>) {
    const { user: _u, ...rest } = s;
    return rest;
  }

  /** Smart-ish distractors: same languages, distinct normalized forms, similar length preferred. */
  private distractors(
    pool: Array<{ id: string; lemma: string; translation: string; sourceLang: string; targetLang: string }>,
    v: VocabRow,
    field: 'lemma' | 'translation',
    rand: () => number,
  ): string[] {
    const correct = normalize(v[field]);
    const target = v[field].length;
    const seen = new Set([correct]);
    const cands = shuffle(
      pool.filter((p) => p.id !== v.id && p.sourceLang === v.sourceLang && p.targetLang === v.targetLang),
      rand,
    ).sort((a, b) => Math.abs(a[field].length - target) - Math.abs(b[field].length - target));
    const out: string[] = [];
    for (const p of cands) {
      const n = normalize(p[field]);
      if (!n || seen.has(n)) continue;
      seen.add(n);
      out.push(p[field]);
      if (out.length === 3) break;
    }
    return out;
  }

  // ---------------------------------------------------------------- audio

  /** TTS for an item without exposing its text in the item payload. */
  async audio(userId: string, vocabId: string): Promise<Buffer> {
    const v = await this.prisma.userVocabulary.findFirst({ where: { id: vocabId, userId }, select: { lemma: true, sourceLang: true } });
    if (!v) throw new NotFoundException('Vocabulary entry not found');
    return this.ai.speak(v.lemma, v.sourceLang);
  }

  // ---------------------------------------------------------------- answer

  async answer(userId: string, dto: AnswerExerciseDto) {
    const prior = await this.prisma.vocabularyReview.findUnique({ where: { answerId: dto.answerId } });
    if (prior) throw new BadRequestException('Answer already recorded');

    const vocab = await this.prisma.userVocabulary.findFirst({ where: { id: dto.vocabId, userId } });
    if (!vocab) throw new NotFoundException('Vocabulary entry not found');

    let grade: GradeResult | null = null;
    let expected = vocab.lemma;
    let judgedByAi = false;
    const exact = (ok: boolean): GradeResult => ({ verdict: ok ? 'correct' : 'wrong', correct: ok, matched: null, distance: ok ? 0 : 1, diff: [] });

    switch (dto.type) {
      case 'flashcard':
        expected = vocab.translation;
        break;
      case 'mcq_meaning':
        expected = vocab.translation;
        grade = exact(normalize(dto.answer ?? '') === normalize(vocab.translation));
        break;
      case 'listening_mcq':
        grade = exact(normalize(dto.answer ?? '', vocab.sourceLang) === normalize(vocab.lemma, vocab.sourceLang));
        break;
      case 'cloze':
      case 'cloze_mcq': {
        const c = buildCloze(vocab.contextSentence, vocab.lemma);
        expected = c?.answer ?? vocab.lemma;
        if (dto.type === 'cloze_mcq') {
          grade = exact(normalize(dto.answer ?? '', vocab.sourceLang) === normalize(expected, vocab.sourceLang));
        } else {
          grade = gradeAnswer(dto.answer ?? '', expected, { lang: vocab.sourceLang, knownWords: await this.deckWords(userId, vocab) });
          // The bare lemma in place of the inflected form counts as "almost" (PRD §4.2 AC2).
          if (!grade.correct && normalize(dto.answer ?? '', vocab.sourceLang) === normalize(vocab.lemma, vocab.sourceLang)) {
            grade = { ...grade, verdict: 'almost', correct: true, reason: 'typo' };
          }
        }
        break;
      }
      default:
        grade = gradeAnswer(dto.answer ?? '', vocab.lemma, { lang: vocab.sourceLang, knownWords: await this.deckWords(userId, vocab) });
    }

    // Optional AI judge for synonyms/valid variants on typed recall & cloze. Falls back to the strict verdict.
    if (grade && grade.verdict === 'wrong' && grade.reason !== 'wrong_script' && (dto.type === 'typed_recall' || dto.type === 'cloze') && (dto.answer ?? '').trim().length > 1) {
      const ok = await this.ai.judgeAnswer({
        expected,
        given: dto.answer!.trim(),
        lang: vocab.sourceLang,
        meaning: vocab.translation,
        context: dto.type === 'cloze' ? vocab.contextSentence : null,
      });
      if (ok === true) {
        grade = { ...grade, verdict: 'almost', correct: true };
        judgedByAi = true;
      }
    }

    const verdict = dto.type === 'flashcard' ? (dto.selfRating === 'again' ? 'wrong' : 'correct') : grade!.verdict;
    const correct = verdict !== 'wrong';
    const rating = outcomeToRating({
      type: dto.type,
      verdict,
      responseMs: dto.responseMs,
      selfRating: dto.selfRating ?? (dto.type === 'flashcard' ? 'good' : undefined),
      hintUsed: dto.hintUsed,
    });
    const extra = !!dto.extra && vocab.fsrsState !== 0 && vocab.dueAt > new Date();

    // Anti-abuse inputs for XP.
    const dayStart = dateFromCalendarKey(calendarDateKey());
    const sameItemCountToday = await this.prisma.vocabularyReview.count({
      where: { vocabId: vocab.id, exerciseType: dto.type, reviewedAt: { gte: dayStart } },
    });
    let xp = xpForAnswer({
      type: dto.type,
      verdict,
      responseMs: dto.responseMs,
      extra,
      sameItemCountToday,
      firstCorrectEver: vocab.fsrsState === 0,
    });

    const progressBefore = await this.todayStats(userId);
    xp = Math.max(0, Math.min(xp, XP_RULES.dailyCap - progressBefore.xpToday));

    const updated = await this.vocabulary.review(userId, vocab.id, { rating } as never, {
      exerciseType: dto.type,
      correct,
      responseMs: dto.responseMs,
      answerId: dto.answerId,
      sessionId: dto.sessionId,
      verdict,
      xp,
      extra,
    });
    const progress = await this.addXp(userId, xp, { allowStreak: !extra || (await this.queueEmpty(userId)) });

    return {
      correct,
      verdict,
      reason: grade?.reason ?? null,
      diff: grade?.diff ?? [],
      judgedByAi,
      expected,
      word: vocab.lemma,
      translation: vocab.translation,
      context: vocab.contextSentence,
      rating,
      requeue: rating === 'again',
      nextDueAt: updated.dueAt,
      intervalDays: updated.intervalDays,
      mastered: updated.mastered,
      xpGained: xp,
      ...progress,
    };
  }

  private async deckWords(userId: string, v: UserVocabulary): Promise<string[]> {
    const rows = await this.prisma.userVocabulary.findMany({
      where: { userId, sourceLang: v.sourceLang, id: { not: v.id } },
      select: { lemma: true },
      take: 2000,
    });
    return rows.map((r) => r.lemma);
  }

  private async queueEmpty(userId: string) {
    return (await this.prisma.userVocabulary.count({ where: { userId, fsrsState: { not: 0 }, dueAt: { lte: new Date() } } })) === 0;
  }

  /** Add XP; when today's goal is first reached, extend the streak (freezes cover missed days). */
  async addXp(userId: string, xp: number, opts: { allowStreak: boolean }) {
    const now = new Date();
    const todayKey = calendarDateKey(now);
    const s = await this.todayStats(userId);
    const xpToday = s.xpToday + xp;
    const data: Prisma.UserUpdateInput = { xpTotal: { increment: xp }, xpToday, xpDate: dateFromCalendarKey(todayKey) };
    let streakCount = s.streakCount;
    let freezes = s.streakFreezes;
    let freezesUsed = 0;
    let streakExtended = false;
    if (opts.allowStreak && xpToday >= s.dailyGoalXp && s.user) {
      const gap = s.user.streakLastDate ? diffCalendarDays(s.user.streakLastDate, now) : null;
      const next = streakOnGoalMet({ count: s.user.streakCount, freezes: s.user.streakFreezes, lastDayGap: gap });
      if (next.extended) {
        streakCount = next.count;
        freezes = next.freezes;
        freezesUsed = next.freezesUsed;
        streakExtended = true;
        Object.assign(data, {
          streakCount: next.count,
          streakFreezes: next.freezes,
          streakLastDate: dateFromCalendarKey(todayKey),
          bestStreak: Math.max(s.bestStreak, next.count),
        });
      }
    }
    const u = await this.prisma.user.update({ where: { id: userId }, data, select: { xpTotal: true } });
    return {
      xpToday,
      xpTotal: u.xpTotal,
      dailyGoalXp: s.dailyGoalXp,
      goalReached: xpToday >= s.dailyGoalXp,
      goalReachedNow: s.xpToday < s.dailyGoalXp && xpToday >= s.dailyGoalXp,
      streakCount,
      streakExtended,
      streakFreezes: freezes,
      freezesUsed,
    };
  }

  // ---------------------------------------------------------------- complete

  async complete(userId: string, sessionId: string) {
    const session = await this.prisma.practiceSession.findFirst({ where: { id: sessionId, userId, practiceType: PracticeType.mixed } });
    if (!session) throw new NotFoundException('Practice session not found');
    const logs = await this.prisma.vocabularyReview.findMany({
      where: { sessionId },
      include: { vocab: { select: { id: true, lemma: true, translation: true, dueAt: true, stability: true } } },
      orderBy: { reviewedAt: 'asc' },
    });
    // First attempt per card decides accuracy; skipped items never count (no log row).
    const first = new Map<string, (typeof logs)[number]>();
    for (const l of logs) if (!first.has(l.vocabId)) first.set(l.vocabId, l);
    const answered = first.size;
    const correctCount = [...first.values()].filter((l) => l.correct).length;
    let bonus = 0;
    let progress = null;
    if (!session.completedAt && answered > 0) {
      bonus = sessionBonusXp(answered, correctCount);
      const allExtra = logs.every((l) => l.extra);
      progress = await this.addXp(userId, bonus, { allowStreak: !allExtra || (await this.queueEmpty(userId)) });
      await this.prisma.practiceSession.update({
        where: { id: sessionId },
        data: { completedAt: new Date(), correctCount, questionCount: answered },
      });
    }
    const missed = [...new Map(logs.filter((l) => !l.correct).map((l) => [l.vocabId, l])).values()];
    const tomorrow = (await this.forecast(userId))[0]?.count ?? 0;
    return {
      answered,
      correct: correctCount,
      accuracy: answered ? round2(correctCount / answered) : 0,
      xpEarned: logs.reduce((s, l) => s + l.xp, 0) + bonus,
      bonusXp: bonus,
      newWords: logs.filter((l) => l.intervalBefore === 0 && l.correct).length,
      mistakes: missed.map((l) => ({ vocabId: l.vocabId, word: l.vocab.lemma, translation: l.vocab.translation, nextDueAt: l.vocab.dueAt })),
      hardest: missed.slice(0, 3).map((l) => l.vocab.lemma),
      dueTomorrow: tomorrow,
      ...(progress ?? this.publicStats(await this.todayStats(userId))),
    };
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Keep review order, spread new cards evenly between reviews. */
function interleave<T>(reviews: T[], fresh: T[]): T[] {
  if (!fresh.length) return reviews;
  if (!reviews.length) return fresh;
  const out: T[] = [];
  const step = Math.max(1, Math.round(reviews.length / (fresh.length + 1)));
  let f = 0;
  reviews.forEach((r, i) => {
    out.push(r);
    if ((i + 1) % step === 0 && f < fresh.length) out.push(fresh[f++]);
  });
  while (f < fresh.length) out.push(fresh[f++]);
  return out;
}

export { MCQ_TYPES };
