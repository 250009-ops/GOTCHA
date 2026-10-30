import { Rating, State, createEmptyCard, fsrs, generatorParameters, type Card } from 'ts-fsrs';
import { scheduleReview, type SrsRatingValue, type SrsState } from '@gotcha/shared';

export type { SrsState };

/** Desired retention per PRD §7. */
export const DESIRED_RETENTION = 0.9;
/** Stability (days) at which a word counts as mastered / "known" (PRD §4.6 AC4). */
export const MASTERED_STABILITY_DAYS = 90;

/** Rollback switch: SRS_ALGORITHM=sm2 restores the legacy scheduler. Default: FSRS. */
export function srsAlgorithm(): 'fsrs' | 'sm2' {
  return process.env.SRS_ALGORITHM?.trim().toLowerCase() === 'sm2' ? 'sm2' : 'fsrs';
}

const scheduler = fsrs(
  generatorParameters({ request_retention: DESIRED_RETENTION, enable_fuzz: true, enable_short_term: true }),
);

const RATING: Record<SrsRatingValue, Rating.Again | Rating.Hard | Rating.Good | Rating.Easy> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export interface CardRow {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  mastered: boolean;
  dueAt: Date;
  lastReviewedAt: Date | null;
  lapses: number;
  stability: number;
  difficulty: number;
  fsrsState: number;
  learningSteps: number;
}

export interface CardUpdate {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  mastered: boolean;
  lapses: number;
  stability: number;
  difficulty: number;
  fsrsState: number;
  learningSteps: number;
}

function toFsrsCard(row: CardRow, now: Date): Card {
  if (row.fsrsState === State.New || row.stability <= 0) {
    // Never reviewed under FSRS. Rows migrated from SM-2 carry stability > 0.
    return createEmptyCard(now);
  }
  return {
    due: row.dueAt,
    stability: row.stability,
    difficulty: row.difficulty || 5,
    elapsed_days: 0,
    scheduled_days: row.intervalDays,
    reps: row.repetitions,
    lapses: row.lapses,
    learning_steps: row.learningSteps,
    state: row.fsrsState as State,
    last_review: row.lastReviewedAt ?? undefined,
  };
}

/** Schedule one review. Every graded practice answer and every flashcard rating goes through here. */
export function reviewCard(row: CardRow, rating: SrsRatingValue, now = new Date(), fuzzSeed?: string): CardUpdate {
  if (srsAlgorithm() === 'sm2') {
    const next = scheduleReview(row, rating, now, fuzzSeed);
    return {
      ...next,
      lapses: row.lapses + (rating === 'again' && row.repetitions > 0 ? 1 : 0),
      stability: row.stability,
      difficulty: row.difficulty,
      fsrsState: row.fsrsState,
      learningSteps: row.learningSteps,
    };
  }
  const { card } = scheduler.next(toFsrsCard(row, now), now, RATING[rating]);
  const intervalDays = Math.max(0, Math.round((card.due.getTime() - now.getTime()) / 86_400_000));
  return {
    // Legacy columns kept in sync (read-only for 2 releases) so old clients still render.
    easeFactor: Math.round((2.5 + (5 - card.difficulty) / 4) * 100) / 100,
    intervalDays,
    repetitions: card.reps,
    dueAt: card.due,
    mastered: card.stability >= MASTERED_STABILITY_DAYS,
    lapses: card.lapses,
    stability: Math.round(card.stability * 10000) / 10000,
    difficulty: Math.round(card.difficulty * 10000) / 10000,
    fsrsState: card.state,
    learningSteps: card.learning_steps,
  };
}

/** Legacy helper (SM-2) kept for the rollback path and old callers. */
export function applySrsReview(
  current: Pick<SrsState, 'easeFactor' | 'intervalDays' | 'repetitions' | 'mastered'>,
  rating: SrsRatingValue,
  now = new Date(),
  fuzzSeed?: string,
): SrsState {
  return scheduleReview(current, rating, now, fuzzSeed);
}
