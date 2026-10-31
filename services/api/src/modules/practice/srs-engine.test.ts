import * as assert from 'node:assert/strict';
import {
  chooseExerciseType,
  goalXpFromMinutes,
  outcomeToRating,
  seededRandom,
  sessionBonusXp,
  streakOnGoalMet,
  displayStreak,
  xpForAnswer,
  buildCloze,
  EXERCISE_TYPES,
  type ExerciseType,
} from '@gotcha/shared';
import { reviewCard, srsAlgorithm, MASTERED_STABILITY_DAYS, type CardRow } from '../../utils/srs';

const now = new Date('2026-10-30T07:00:00.000Z');
const fresh: CardRow = {
  easeFactor: 2.5, intervalDays: 0, repetitions: 0, mastered: false, dueAt: now, lastReviewedAt: null,
  lapses: 0, stability: 0, difficulty: 0, fsrsState: 0, learningSteps: 0,
};

// ---- FSRS scheduling (default algorithm)
delete process.env.SRS_ALGORITHM;
assert.equal(srsAlgorithm(), 'fsrs');

// New card → learning step (minutes, same day), state Learning
const g1 = reviewCard(fresh, 'good', now);
assert.equal(g1.fsrsState, 1, 'new + good → learning');
assert.ok(g1.dueAt.getTime() - now.getTime() <= 15 * 60_000, 'learning step is minutes, not days');
assert.ok(g1.stability > 0);

// Again on new → short relearn
const a1 = reviewCard(fresh, 'again', now);
assert.ok(a1.dueAt.getTime() - now.getTime() <= 10 * 60_000);

// Easy on new graduates straight to Review with days
const e1 = reviewCard(fresh, 'easy', now);
assert.equal(e1.fsrsState, 2);
assert.ok(e1.intervalDays >= 1);

// Ratings order intervals for a review card
const review: CardRow = { ...fresh, fsrsState: 2, stability: 10, difficulty: 5, repetitions: 4, intervalDays: 10, lastReviewedAt: new Date(now.getTime() - 10 * 86_400_000), dueAt: now };
const h = reviewCard(review, 'hard', now);
const g = reviewCard(review, 'good', now);
const e = reviewCard(review, 'easy', now);
assert.ok(h.intervalDays <= g.intervalDays && g.intervalDays <= e.intervalDays, `hard ${h.intervalDays} ≤ good ${g.intervalDays} ≤ easy ${e.intervalDays}`);
assert.ok(g.stability > review.stability, 'successful recall grows stability');

// Lapse: again on a review card → relearning, lapses+1, stability drops
const lapse = reviewCard(review, 'again', now);
assert.equal(lapse.fsrsState, 3);
assert.equal(lapse.lapses, 1);
assert.ok(lapse.stability < review.stability);

// Mastered once stability ≥ 90d
const strong: CardRow = { ...review, stability: 120, intervalDays: 120, lastReviewedAt: new Date(now.getTime() - 120 * 86_400_000) };
assert.equal(reviewCard(strong, 'good', now).mastered, true);
assert.ok(MASTERED_STABILITY_DAYS === 90);

// SM-2 rollback flag
process.env.SRS_ALGORITHM = 'sm2';
assert.equal(srsAlgorithm(), 'sm2');
const s1 = reviewCard(fresh, 'good', now);
assert.equal(s1.intervalDays, 1);
const s2 = reviewCard({ ...fresh, ...s1, lastReviewedAt: now }, 'good', now);
assert.equal(s2.intervalDays, 3);
const sa = reviewCard({ ...fresh, ...s2, lastReviewedAt: now }, 'again', now);
assert.equal(sa.repetitions, 0);
assert.ok(sa.dueAt.getTime() - now.getTime() === 10 * 60_000, 'SM-2 relearn step 10 min');
delete process.env.SRS_ALGORITHM;

// ---- outcome → rating (PRD §4)
assert.equal(outcomeToRating({ type: 'typed_recall', verdict: 'wrong' }), 'again');
assert.equal(outcomeToRating({ type: 'typed_recall', verdict: 'almost' }), 'hard');
assert.equal(outcomeToRating({ type: 'typed_recall', verdict: 'correct', hintUsed: true }), 'hard');
assert.equal(outcomeToRating({ type: 'typed_recall', verdict: 'correct', responseMs: 20_000 }), 'hard');
assert.equal(outcomeToRating({ type: 'typed_recall', verdict: 'correct', responseMs: 5_000 }), 'good');
assert.equal(outcomeToRating({ type: 'typed_recall', verdict: 'correct', responseMs: 2_000 }), 'easy');
assert.equal(outcomeToRating({ type: 'mcq_meaning', verdict: 'correct', responseMs: 500 }), 'good', 'recognition is never easy');
assert.equal(outcomeToRating({ type: 'flashcard', verdict: 'correct', selfRating: 'easy' }), 'easy');

// ---- XP (PRD §6)
assert.equal(xpForAnswer({ type: 'cloze', verdict: 'correct', responseMs: 4000 }), 10);
assert.equal(xpForAnswer({ type: 'cloze', verdict: 'almost', responseMs: 4000 }), 7);
assert.equal(xpForAnswer({ type: 'cloze', verdict: 'wrong', responseMs: 4000 }), 2);
assert.equal(xpForAnswer({ type: 'cloze', verdict: 'correct', responseMs: 300 }), 0, 'typing <600ms earns nothing');
assert.equal(xpForAnswer({ type: 'mcq_meaning', verdict: 'correct', responseMs: 300 }), 10, 'tap types are fine fast');
assert.equal(xpForAnswer({ type: 'typed_recall', verdict: 'correct', sameItemCountToday: 3 }), 0);
assert.equal(xpForAnswer({ type: 'typed_recall', verdict: 'correct', firstCorrectEver: true }), 15);
assert.equal(xpForAnswer({ type: 'typed_recall', verdict: 'correct', extra: true }), 5);
assert.equal(sessionBonusXp(10, 10), 30);
assert.equal(sessionBonusXp(10, 9), 20);
assert.equal(sessionBonusXp(5, 5), 20);
assert.equal(sessionBonusXp(0, 0), 0);
assert.equal(goalXpFromMinutes(15), 60);
assert.equal(goalXpFromMinutes(5), 30);
assert.equal(goalXpFromMinutes(30), 120);
assert.equal(goalXpFromMinutes(60), 200);

// ---- streak + freezes (max 2, earn 1 per 7-day milestone)
assert.deepEqual(streakOnGoalMet({ count: 0, freezes: 0, lastDayGap: null }), { count: 1, freezes: 0, freezesUsed: 0, extended: true });
assert.equal(streakOnGoalMet({ count: 5, freezes: 0, lastDayGap: 0 }).extended, false, 'once per day');
assert.equal(streakOnGoalMet({ count: 5, freezes: 0, lastDayGap: 1 }).count, 6);
assert.deepEqual(streakOnGoalMet({ count: 6, freezes: 0, lastDayGap: 1 }), { count: 7, freezes: 1, freezesUsed: 0, extended: true });
assert.deepEqual(streakOnGoalMet({ count: 13, freezes: 2, lastDayGap: 1 }), { count: 14, freezes: 2, freezesUsed: 0, extended: true }, 'cap 2');
assert.deepEqual(streakOnGoalMet({ count: 9, freezes: 1, lastDayGap: 2 }), { count: 10, freezes: 0, freezesUsed: 1, extended: true });
assert.deepEqual(streakOnGoalMet({ count: 9, freezes: 2, lastDayGap: 3 }), { count: 10, freezes: 0, freezesUsed: 2, extended: true });
assert.equal(streakOnGoalMet({ count: 9, freezes: 1, lastDayGap: 3 }).count, 1, 'not enough freezes → reset');
assert.equal(displayStreak(9, 1, 2), 9);
assert.equal(displayStreak(9, 0, 2), 0);
assert.equal(displayStreak(9, 0, 1), 9);

// ---- adaptive type selection
const rand = seededRandom(42);
const allowed = new Set<ExerciseType>(EXERCISE_TYPES);
for (let i = 0; i < 200; i++) {
  const t = chooseExerciseType({ state: 0, stability: 0, clozeable: true, canMcq: true }, { listening: true }, 0.85, rand);
  assert.ok(['flashcard', 'mcq_meaning', 'cloze_mcq'].includes(t), `new card got ${t}`);
  const m = chooseExerciseType({ state: 2, stability: 40, clozeable: true, canMcq: true }, { listening: true }, 0.85, rand);
  assert.ok(['typed_recall', 'cloze', 'dictation', 'listening_mcq'].includes(m), `mature card got ${m}`);
  assert.ok(allowed.has(m));
  const noListen = chooseExerciseType({ state: 2, stability: 40, clozeable: false, canMcq: false }, { listening: false }, 0.85, rand);
  assert.equal(noListen, 'typed_recall');
}
// step-down when struggling: mature card → young pool
const struggling = new Set(Array.from({ length: 100 }, () => chooseExerciseType({ state: 2, stability: 40, clozeable: true, canMcq: true }, { listening: false }, 0.5, rand)));
assert.ok(struggling.has('mcq_meaning'));
// never 3 of the same type in a row
for (let i = 0; i < 100; i++) {
  const t = chooseExerciseType({ state: 2, stability: 40, clozeable: false, canMcq: false }, { listening: true }, 0.85, rand, ['typed_recall', 'typed_recall']);
  assert.notEqual(t, 'typed_recall');
}

// ---- cloze builder
assert.equal(buildCloze('She was running late again.', 'run')?.answer, 'running');
assert.equal(buildCloze('Kitoblarni o‘qidim.', 'kitob')?.answer, 'Kitoblarni');
assert.equal(buildCloze('Nothing here.', 'elephant'), null);
assert.equal(buildCloze(null, 'run'), null);

console.log('srs-engine.test.ts ok');
