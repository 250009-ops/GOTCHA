import type { SrsRating } from '@gotcha/shared';

export interface SrsState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  dueAt: Date;
  mastered: boolean;
}

export function applySrsReview(
  current: Pick<SrsState, 'easeFactor' | 'intervalDays' | 'repetitions' | 'mastered'>,
  rating: SrsRating,
  now = new Date(),
): SrsState {
  let { easeFactor, intervalDays, repetitions, mastered } = current;

  const intervalBefore = intervalDays;

  if (rating === 'again') {
    repetitions = 0;
    intervalDays = 0;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 3;
    else intervalDays = Math.round(intervalDays * easeFactor);

    if (rating === 'hard') {
      easeFactor = Math.max(1.3, easeFactor - 0.15);
      intervalDays = Math.max(1, Math.round(intervalDays * 0.8));
    } else if (rating === 'easy') {
      easeFactor += 0.15;
      intervalDays = Math.round(intervalDays * 1.3);
    }
  }

  if (repetitions >= 5 && intervalDays >= 21) mastered = true;

  const dueAt = new Date(now);
  dueAt.setDate(dueAt.getDate() + intervalDays);

  return {
    easeFactor,
    intervalDays,
    repetitions,
    dueAt,
    mastered,
  };
}
