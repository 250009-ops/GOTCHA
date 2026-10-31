/**
 * Daily learner limits per plan (Sarvarbek 31 Oct 14:18): Free 20 lookups + 10 quizzes, Plus 200 + 200.
 * Single source for enforcement AND every user-facing limit text. Env overrides are for ops only.
 */
const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : d;
};
/** lookupsHardPerDay: absolute daily ceiling (Plus 500) above the 200 full-AI explanations; the 200 is what is enforced and shown today. */
export type PlanLimits = { lookupsPerDay: number; quizzesPerDay: number; lookupsHardPerDay: number };
export function planLimits(tier: string | null | undefined, env: NodeJS.ProcessEnv = process.env): PlanLimits {
  return tier === 'premium'
    ? { lookupsPerDay: int(env.PLUS_DAILY_LOOKUPS, 200), quizzesPerDay: int(env.PLUS_DAILY_QUIZZES, 200), lookupsHardPerDay: int(env.PLUS_DAILY_LOOKUPS_HARD, 500) }
    : { lookupsPerDay: int(env.FREE_DAILY_LOOKUPS, 20), quizzesPerDay: int(env.FREE_DAILY_QUIZZES, 10), lookupsHardPerDay: int(env.FREE_DAILY_LOOKUPS, 20) };
}
