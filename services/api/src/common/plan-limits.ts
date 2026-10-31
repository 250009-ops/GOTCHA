/**
 * Daily learner limits per plan (Sarvarbek 31 Oct 14:40, overrides 14:18 and the 2:25 relay):
 * Free 20 lookups + 10 quizzes; Plus 200 quizzes and NO daily word-lookup cap (lookupsPerDay = null).
 * Lines up with payments-02 (plus.ai_lookup_quota / plus.lookup_hard_cap null = no cap).
 * Single source for enforcement AND every user-facing limit text. Env overrides are for ops only (Free + quizzes).
 * Copy never names a Plus lookup number or a limit claim (the "no daily limit" line ships with payments-02, guard G1).
 */
const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : d;
};
/** lookupsPerDay null = no daily lookup cap (Plus). */
export type PlanLimits = { lookupsPerDay: number | null; quizzesPerDay: number };
export function freeLimits(env: NodeJS.ProcessEnv = process.env): { lookupsPerDay: number; quizzesPerDay: number } {
  return { lookupsPerDay: int(env.FREE_DAILY_LOOKUPS, 20), quizzesPerDay: int(env.FREE_DAILY_QUIZZES, 10) };
}
export function planLimits(tier: string | null | undefined, env: NodeJS.ProcessEnv = process.env): PlanLimits {
  return tier === 'premium' ? { lookupsPerDay: null, quizzesPerDay: int(env.PLUS_DAILY_QUIZZES, 200) } : freeLimits(env);
}
/** True when a daily lookup quota actually caps (null / 0 / >= 1e6 = no cap). */
export const lookupCapped = (q: number | null | undefined): q is number => typeof q === 'number' && q > 0 && q < 1_000_000;
