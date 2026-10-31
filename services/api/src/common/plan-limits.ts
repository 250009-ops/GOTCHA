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
  return {
    lookupsPerDay: configured.freeLookups ?? int(env.FREE_DAILY_LOOKUPS, 20),
    quizzesPerDay: configured.freeQuizzes ?? int(env.FREE_DAILY_QUIZZES, 10),
  };
}
export function planLimits(tier: string | null | undefined, env: NodeJS.ProcessEnv = process.env): PlanLimits {
  return tier === 'premium' ? { lookupsPerDay: null, quizzesPerDay: configured.plusQuizzes ?? int(env.PLUS_DAILY_QUIZZES, 200) } : freeLimits(env);
}
/** True when a daily lookup quota actually caps (null / 0 / >= 1e6 = no cap). */
export const lookupCapped = (q: number | null | undefined): q is number => typeof q === 'number' && q > 0 && q < 1_000_000;

/**
 * final-5 (A4/B1): admin-editable caps live in platform_settings (never subscription_plans.ai_daily_quota /
 * import_limit, which hold legacy prod values 5000/100). Read through a 60 s cache; planLimits() stays sync and
 * prefers these values over env/defaults. Imports (3/day, 50 pages/month) stay in platform_settings importFreeLimits.
 */
export const PLAN_LIMIT_KEYS = {
  freeLookups: 'caps.free.lookups',
  freeQuizzes: 'caps.free.quizzes',
  plusQuizzes: 'caps.plus.quizzes',
} as const;
type Configured = Partial<Record<keyof typeof PLAN_LIMIT_KEYS, number>>;
let configured: Configured = {};
let loadedAt = 0;
export const PLAN_LIMITS_TTL_MS = 60_000;
const settingInt = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  return Number.isInteger(n) && n >= 0 && n <= 100_000 ? n : undefined;
};
type SettingsDb = { platformSetting: { findMany: (a: unknown) => Promise<Array<{ key: string; value: unknown }>> } };
export async function refreshPlanLimits(prisma: unknown, now = Date.now()): Promise<void> {
  if (now - loadedAt < PLAN_LIMITS_TTL_MS) return;
  try {
    const rows = await (prisma as SettingsDb).platformSetting.findMany({ where: { key: { in: Object.values(PLAN_LIMIT_KEYS) } } });
    const next: Configured = {};
    for (const [k, key] of Object.entries(PLAN_LIMIT_KEYS) as Array<[keyof typeof PLAN_LIMIT_KEYS, string]>) {
      const v = settingInt(rows.find((r) => r.key === key)?.value);
      if (v !== undefined) next[k] = v;
    }
    configured = next;
    loadedAt = now;
  } catch {
    /* keep the last values; defaults apply */
  }
}
export function resetPlanLimitsCache() { loadedAt = 0; }
export function setConfiguredPlanLimitsForTest(c: Configured) { configured = c; loadedAt = Date.now(); }
/** Effective caps: platform_settings → env → defaults (20 / 10 / 200). */
export function effectivePlanLimits(env: NodeJS.ProcessEnv = process.env) {
  const f = freeLimits(env);
  return {
    freeLookups: configured.freeLookups ?? f.lookupsPerDay,
    freeQuizzes: configured.freeQuizzes ?? f.quizzesPerDay,
    plusQuizzes: configured.plusQuizzes ?? int(env.PLUS_DAILY_QUIZZES, 200),
  };
}

/** All daily counters reset at local midnight Asia/Tashkent (UTC+5, no DST). Returns the next reset instant. */
export const LIMIT_TIMEZONE = 'Asia/Tashkent';
export function nextLimitResetAt(now = new Date()): Date {
  const off = 5 * 3_600_000;
  const local = new Date(now.getTime() + off);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + 1) - off);
}
/** 403 body for a reached daily cap; message kept for older clients that match on it. */
export function dailyLimitBody(kind: 'lookup' | 'quiz', limit: number, now = new Date()) {
  return {
    statusCode: 403,
    code: 'DAILY_LIMIT_REACHED',
    kind,
    limit,
    resetAt: nextLimitResetAt(now).toISOString(),
    timezone: LIMIT_TIMEZONE,
    message: kind === 'lookup' ? 'Daily AI lookup limit reached. Try again tomorrow.' : 'Daily AI quiz quota exceeded',
  };
}
