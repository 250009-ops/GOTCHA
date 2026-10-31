/** A subscription row counts only while its end date is in the future (passes must actually end). */
export const activeSubWhere = (now = new Date()) => ({
  status: 'active' as const,
  OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
});

/** Plus daily caps (admin-editable PlatformSetting keys). Sarvarbek 13:57: Plus lookups 200/day (replaces the 500 fair-use cap); free stays 50; quizzes 50. */
export const PLUS_FAIR_USE_KEYS = { lookups: 'plus.fair_use.lookups_per_day', quizzes: 'plus.fair_use.quizzes_per_day' } as const;
export const PLUS_FAIR_USE_DEFAULTS = { lookups: 200, quizzes: 200 } as const;
export function fairUseCap(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
