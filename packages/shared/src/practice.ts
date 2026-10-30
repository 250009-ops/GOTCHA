/**
 * Practice engine primitives shared by the API (authoritative grading + scheduling)
 * and clients (instant UI hints). Pure functions only — no I/O.
 */

export const EXERCISE_TYPES = [
  'flashcard', // see L2 word, recall meaning, self-rate (Again/Hard/Good/Easy)
  'mcq_meaning', // recognition: pick the right L1 meaning
  'typed_recall', // production: see L1 gloss, type the L2 word
  'cloze', // production: real context sentence with the word blanked, type it
  'cloze_mcq', // recognition fallback for learning cards: pick the word for the blank
  'listening_mcq', // "pick what you hear": TTS plays, choose the written word
  'dictation', // SHOULD: hear the word, type it
] as const;
export type ExerciseType = (typeof EXERCISE_TYPES)[number];
/** Types where the learner produces the answer (typing). */
export const PRODUCTION_TYPES: readonly ExerciseType[] = ['typed_recall', 'cloze', 'dictation'];

export type SrsRatingValue = 'again' | 'hard' | 'good' | 'easy';

import { normalize } from './grading';
export * from './grading';

/** Back-compat helper: normalize without language specifics. */
export function normalizeAnswer(input: string, lang?: string): string {
  return normalize(input, lang);
}

function foldDiacritics(input: string): string {
  return normalize(input).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u02BB\u02BC]/g, '').normalize('NFC');
}

// ---------------------------------------------------------------------------
// Exercise builders
// ---------------------------------------------------------------------------

const WORD_RE = /[\p{L}\p{M}'\u02BB\u02BC\u2019-]+/gu;

/** Find the inflected form of `lemma` in `sentence` (e.g. "ran" won't match, "running" matches "run"). */
export function findWordForm(sentence: string, lemma: string): { form: string; index: number } | null {
  if (!sentence || !lemma) return null;
  const target = foldDiacritics(lemma);
  if (!target) return null;
  // Multi-word lemma: direct substring search.
  if (/\s/.test(lemma.trim())) {
    const idx = sentence.toLowerCase().indexOf(lemma.trim().toLowerCase());
    return idx >= 0 ? { form: sentence.slice(idx, idx + lemma.trim().length), index: idx } : null;
  }
  const stem = target.length <= 4 ? target : target.slice(0, Math.max(3, target.length - 2));
  let best: { form: string; index: number; score: number } | null = null;
  for (const m of sentence.matchAll(WORD_RE)) {
    const folded = foldDiacritics(m[0]);
    let score = -1;
    if (folded === target) score = 3;
    else if (folded.startsWith(target)) score = 2;
    else if (folded.startsWith(stem) && Math.abs(folded.length - target.length) <= 4) score = 1;
    if (score > 0 && (!best || score > best.score)) best = { form: m[0], index: m.index ?? 0, score };
  }
  return best ? { form: best.form, index: best.index } : null;
}

export interface Cloze {
  before: string;
  after: string;
  answer: string;
  hint: string; // first letter + length, e.g. "r _ _ _ _ _ _"
}

export function buildCloze(sentence: string | null | undefined, lemma: string): Cloze | null {
  if (!sentence || sentence.length > 320) return null;
  const hit = findWordForm(sentence, lemma);
  if (!hit) return null;
  const answer = hit.form;
  const hint = [answer[0], ...Array.from({ length: Math.max(0, answer.length - 1) }, () => '_')].join(' ');
  return {
    before: sentence.slice(0, hit.index),
    after: sentence.slice(hit.index + answer.length),
    answer,
    hint,
  };
}

/** Split a sentence into tokens for the word-order exercise (punctuation stays attached). */
export function sentenceTokens(sentence: string): string[] {
  return (sentence ?? '').trim().split(/\s+/).filter(Boolean);
}

export function wordOrderEligible(sentence: string | null | undefined): boolean {
  if (!sentence) return false;
  const n = sentenceTokens(sentence).length;
  return n >= 3 && n <= 12;
}

/** Deterministic PRNG (mulberry32) so a session can be rebuilt identically. */
export function seededRandom(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffle<T>(items: T[], rand: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Shuffle that never returns the original order (when possible). */
export function scramble(tokens: string[], seed: number): string[] {
  if (tokens.length < 2) return [...tokens];
  const rand = seededRandom(seed);
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = shuffle(tokens, rand);
    if (s.join(' ') !== tokens.join(' ')) return s;
  }
  return [...tokens.slice(1), tokens[0]];
}

// ---------------------------------------------------------------------------
// Adaptive type selection
// ---------------------------------------------------------------------------

export interface CardSnapshot {
  /** 0 new, 1 learning, 2 review, 3 relearning (FSRS State). */
  state: number;
  /** FSRS stability in days (0 for new). */
  stability: number;
  lapses?: number;
  clozeable: boolean;
  canMcq: boolean;
}

export interface Capabilities {
  listening: boolean;
}

/**
 * PRD §5: new → recognition / MCQ cloze; young → typed cloze / listening; mature → typed recall / dictation.
 * `skill` = rolling accuracy of the last 10 items: >0.9 steps up, <0.75 steps down.
 * `recent` = types of the previous items (never more than 2 of the same type in a row).
 */
export function chooseExerciseType(
  card: CardSnapshot,
  caps: Capabilities,
  skill: number,
  rand: () => number,
  recent: ExerciseType[] = [],
): ExerciseType {
  let stage = card.state === 0 ? 0 : card.state === 1 || card.state === 3 || card.stability < 7 ? 1 : 2;
  if ((card.lapses ?? 0) >= 3) stage = Math.min(stage, 1);
  if (skill > 0.9) stage += 1;
  if (skill < 0.75) stage -= 1;

  const pool: ExerciseType[] = [];
  if (stage <= 0) {
    pool.push('flashcard');
    if (card.canMcq) pool.push('mcq_meaning', 'mcq_meaning');
    if (card.clozeable && card.canMcq) pool.push('cloze_mcq');
  } else if (stage === 1) {
    if (card.canMcq) pool.push('mcq_meaning');
    pool.push('typed_recall');
    if (card.clozeable) pool.push('cloze', 'cloze');
    if (caps.listening && card.canMcq) pool.push('listening_mcq', 'listening_mcq');
  } else {
    pool.push('typed_recall', 'typed_recall');
    if (card.clozeable) pool.push('cloze', 'cloze');
    if (caps.listening) pool.push('dictation');
    if (caps.listening && card.canMcq) pool.push('listening_mcq');
  }
  const blocked = recent.length >= 2 && recent[recent.length - 1] === recent[recent.length - 2] ? recent[recent.length - 1] : null;
  const allowed = pool.filter((t) => t !== blocked);
  const from = allowed.length ? allowed : ['flashcard' as ExerciseType].filter((t) => t !== blocked).concat(pool);
  return from[Math.floor(rand() * from.length)];
}

// ---------------------------------------------------------------------------
// Scheduling (SM-2 family with learning steps, lapses and fuzz)
// ---------------------------------------------------------------------------

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  mastered: boolean;
}

export const RELEARN_MINUTES = 10;
export const MASTERED_INTERVAL_DAYS = 21;
export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;

/**
 * Sound SM-2 variant:
 *  - again: relearn in 10 minutes, repetitions reset, ease −0.2
 *  - first success: 1d (easy 3d); second: 3d (hard 2d, easy 5d); then interval × ease
 *  - hard: ×1.2 and ease −0.15; easy: × ease × 1.3 and ease +0.15
 *  - intervals > 2d get deterministic ±5% fuzz to spread review load
 *  - interval never shrinks on a successful review
 *  - mastered once interval ≥ 21d; a lapse un-masters
 */
export function scheduleReview(
  current: Pick<SrsState, 'easeFactor' | 'intervalDays' | 'repetitions' | 'mastered'>,
  rating: SrsRatingValue,
  now: Date = new Date(),
  fuzzSeed?: string,
): SrsState {
  let ease = Number.isFinite(current.easeFactor) ? current.easeFactor : 2.5;
  let reps = Math.max(0, current.repetitions | 0);
  const prevInterval = Math.max(0, current.intervalDays | 0);
  let interval: number;
  const due = new Date(now);

  if (rating === 'again') {
    ease = Math.max(MIN_EASE, ease - 0.2);
    due.setTime(now.getTime() + RELEARN_MINUTES * 60_000);
    return { easeFactor: round2(ease), intervalDays: 0, repetitions: 0, dueAt: due, mastered: false };
  }

  reps += 1;
  if (reps === 1) {
    interval = rating === 'easy' ? 3 : 1;
  } else if (reps === 2) {
    interval = rating === 'hard' ? 2 : rating === 'easy' ? 5 : 3;
  } else {
    const base = Math.max(1, prevInterval);
    if (rating === 'hard') interval = base * 1.2;
    else if (rating === 'easy') interval = base * ease * 1.3;
    else interval = base * ease;
  }

  if (rating === 'hard') ease = Math.max(MIN_EASE, ease - 0.15);
  if (rating === 'easy') ease = Math.min(MAX_EASE, ease + 0.15);

  interval = Math.max(prevInterval + (reps > 2 ? 1 : 0), Math.round(interval));
  if (interval > 2) {
    const rand = seededRandom(hashString(`${fuzzSeed ?? ''}|${reps}|${interval}`))();
    interval = Math.max(1, Math.round(interval * (0.95 + rand * 0.1)));
  }
  interval = Math.min(interval, 365);
  due.setDate(due.getDate() + interval);
  return {
    easeFactor: round2(ease),
    intervalDays: interval,
    repetitions: reps,
    dueAt: due,
    mastered: interval >= MASTERED_INTERVAL_DAYS,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** PRD §4: wrong→Again; almost / hint / slow (>2× median)→Hard; correct→Good; fast production w/o hint→Easy. */
export function outcomeToRating(o: {
  type: ExerciseType;
  verdict: 'correct' | 'almost' | 'wrong';
  responseMs?: number;
  selfRating?: SrsRatingValue;
  hintUsed?: boolean;
  medianMs?: number;
}): SrsRatingValue {
  if (o.type === 'flashcard' && o.selfRating) return o.selfRating;
  if (o.verdict === 'wrong') return 'again';
  const median = o.medianMs ?? (PRODUCTION_TYPES.includes(o.type) ? 6000 : 3500);
  if (o.verdict === 'almost' || o.hintUsed) return 'hard';
  if (o.responseMs != null && o.responseMs > 2 * median) return 'hard';
  if (PRODUCTION_TYPES.includes(o.type) && o.responseMs != null && o.responseMs < median * 0.5) return 'easy';
  return 'good';
}

// ---------------------------------------------------------------------------
// XP, goals, streak freezes (PRD §6)
// ---------------------------------------------------------------------------

export const XP_RULES = {
  correct: 10,
  almost: 7,
  wrong: 2,
  newWordLearned: 5,
  sessionComplete: 20,
  perfectSession: 10,
  perfectMinItems: 10,
  extraMultiplier: 0.5,
  dailyCap: 1500,
  minTypingMs: 600,
  maxSameItemPerDay: 3,
} as const;

export const DAILY_GOAL_OPTIONS = [30, 60, 120, 200] as const;
export type DailyGoalXp = (typeof DAILY_GOAL_OPTIONS)[number];
export const DEFAULT_DAILY_GOAL_XP: DailyGoalXp = 60;
export const MAX_STREAK_FREEZES = 2;
export const FREEZE_EVERY_DAYS = 7;

/** Legacy minutes goal → XP goal (15 min ≈ Regular 60). */
export function goalXpFromMinutes(minutes: number | null | undefined): DailyGoalXp {
  const m = minutes ?? 15;
  if (m <= 10) return 30;
  if (m <= 20) return 60;
  if (m <= 40) return 120;
  return 200;
}

export function xpForAnswer(o: {
  type: ExerciseType;
  verdict: 'correct' | 'almost' | 'wrong';
  responseMs?: number;
  extra?: boolean;
  sameItemCountToday?: number;
  firstCorrectEver?: boolean;
}): number {
  if (PRODUCTION_TYPES.includes(o.type) && o.responseMs != null && o.responseMs < XP_RULES.minTypingMs) return 0;
  if ((o.sameItemCountToday ?? 0) >= XP_RULES.maxSameItemPerDay) return 0;
  let xp: number = XP_RULES[o.verdict];
  if (o.firstCorrectEver && o.verdict !== 'wrong') xp += XP_RULES.newWordLearned;
  if (o.extra) xp = Math.ceil(xp * XP_RULES.extraMultiplier);
  return xp;
}

export function sessionBonusXp(answered: number, correct: number): number {
  if (answered <= 0) return 0;
  let xp = XP_RULES.sessionComplete;
  if (answered >= XP_RULES.perfectMinItems && correct === answered) xp += XP_RULES.perfectSession;
  return xp;
}

/**
 * Streak transition when the daily goal is met today.
 * Missed days are covered by freezes (auto-consumed); a 7-day milestone earns one (max 2).
 */
export function streakOnGoalMet(
  prev: { count: number; freezes: number; lastDayGap: number | null },
): { count: number; freezes: number; freezesUsed: number; extended: boolean } {
  const { count, freezes, lastDayGap } = prev;
  if (lastDayGap === 0) return { count: Math.max(count, 1), freezes, freezesUsed: 0, extended: false };
  let next: number;
  let used = 0;
  if (lastDayGap == null || count <= 0) next = 1;
  else if (lastDayGap === 1) next = count + 1;
  else if (lastDayGap - 1 <= freezes) {
    used = lastDayGap - 1;
    next = count + 1;
  } else next = 1;
  let f = freezes - used;
  if (next > 0 && next % FREEZE_EVERY_DAYS === 0) f = Math.min(MAX_STREAK_FREEZES, f + 1);
  return { count: next, freezes: f, freezesUsed: used, extended: true };
}

/** Displayed streak: alive if the gap since the last credited day can be covered by freezes. */
export function displayStreak(count: number, freezes: number, lastDayGap: number | null): number {
  if (lastDayGap == null) return 0;
  return lastDayGap <= 1 + freezes ? count : 0;
}
