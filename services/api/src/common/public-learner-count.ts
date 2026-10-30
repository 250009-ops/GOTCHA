/**
 * Public learner count shown on the marketing site / auth panel.
 *
 * Never invent a number: below the threshold the stat is hidden (0 = "do not render a numeral"),
 * at or above it the real live-learner count is shown. There is no floor or fallback figure.
 */
export const DEFAULT_MARKETING_MIN_LEARNER_COUNT = 100;

export function marketingMinLearnerCount(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.MARKETING_MIN_LEARNER_COUNT);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_MARKETING_MIN_LEARNER_COUNT;
}

export function publicLearnerCount(realCount: number, min = marketingMinLearnerCount()): number {
  const n = Number.isFinite(realCount) && realCount > 0 ? Math.floor(realCount) : 0;
  return n >= min && n > 0 ? n : 0;
}
