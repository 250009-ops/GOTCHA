// payments-02 daily caps, read from the DB at runtime (cached ≤ 60 s, no deploy needed).
// WLF-12: caps come from platform_settings only; subscription_plans.ai_daily_quota / import_limit / quiz_daily_quota are NOT read
// (prod rows hold legacy values: Free 5000 lookups / 100 imports, Premium 1000000).
//   Free  lookups  = platform_settings 'caps.free.lookups'  (20)
//   Free  quizzes  = platform_settings 'caps.free.quizzes'  (10)
//   Plus  quizzes  = platform_settings 'caps.plus.quizzes'  (200)
//   Plus  full AI lookups = platform_settings 'plus.ai_lookup_quota'  (plusAiLookupQuota)  null = UNLIMITED (Sarvarbek 14:32)
//   Plus  hidden hard cap = platform_settings 'plus.lookup_hard_cap'  (plusLookupHardCap)  null = none
// When a Plus AI quota is set, lookups past it go to dictionary mode (no OpenAI) up to the hidden cap. Dormant while null.
// All counters reset at Asia/Tashkent local midnight.
import { limitDayStart } from './plan-limits';
import { HttpException, HttpStatus } from '@nestjs/common';
import { DAILY_CAP_FALLBACKS, DAILY_CAP_KEYS, PLUS_AI_LOOKUP_QUOTA_KEY, PLUS_LOOKUP_HARD_CAP_KEY, dailyLimitBody, nextLimitReset, type CapKind, type CapPlan } from '@gotcha/shared';
import { activeSubWhere } from './plan-active';

export type PlanCaps = {
  free: { lookups: number; quizzes: number };
  /** lookups: null = unlimited full AI lookups. */
  plus: { lookups: number | null; quizzes: number };
  /** Hidden cap on dictionary-mode lookups (only used when plus.lookups is set). null = none. */
  plusLookupHardCap: number | null;
};
export const PLAN_CAPS_TTL_MS = 60_000;

let cache: { at: number; caps: PlanCaps } | null = null;
export function resetPlanCapsCache() { cache = null; }

type PlanRow = { tier: string; aiDailyQuota: number; quizDailyQuota?: number | null };
type Db = {
  subscriptionPlan?: { findMany?: (a: unknown) => Promise<PlanRow[]> };
  platformSetting?: { findMany?: (a: unknown) => Promise<Array<{ key: string; value: unknown }>> };
  userSubscription?: { findFirst?: (a: unknown) => Promise<{ plan?: { tier?: string } | null } | null> };
};

const int = (v: unknown, fallback: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};
/** null / missing / invalid / 0 → null (unlimited). */
export const optionalCap = (v: unknown): number | null => {
  const n = int(v, -1);
  return n > 0 ? n : null;
};

export async function getPlanCaps(prisma: unknown, now = Date.now()): Promise<PlanCaps> {
  if (cache && now - cache.at < PLAN_CAPS_TTL_MS) return cache.caps;
  const db = prisma as Db;
  const settings = await Promise.resolve()
    .then(() => db.platformSetting?.findMany?.({ where: { key: { in: [PLUS_AI_LOOKUP_QUOTA_KEY, PLUS_LOOKUP_HARD_CAP_KEY, DAILY_CAP_KEYS.freeLookups, DAILY_CAP_KEYS.freeQuizzes, DAILY_CAP_KEYS.plusQuizzes] } } }) ?? [])
    .catch((): Array<{ key: string; value: unknown }> => []);
  const setting = (k: string) => settings.find((s) => s.key === k)?.value;
  const plusLookups = optionalCap(setting(PLUS_AI_LOOKUP_QUOTA_KEY));
  const hard = optionalCap(setting(PLUS_LOOKUP_HARD_CAP_KEY));
  const caps: PlanCaps = {
    free: { lookups: int(setting(DAILY_CAP_KEYS.freeLookups), DAILY_CAP_FALLBACKS.free.lookups), quizzes: int(setting(DAILY_CAP_KEYS.freeQuizzes), DAILY_CAP_FALLBACKS.free.quizzes) },
    plus: { lookups: plusLookups, quizzes: int(setting(DAILY_CAP_KEYS.plusQuizzes), DAILY_CAP_FALLBACKS.plus.quizzes) },
    plusLookupHardCap: plusLookups == null ? null : hard == null ? null : Math.max(hard, plusLookups),
  };
  cache = { at: now, caps };
  return caps;
}

export async function userCapPlan(prisma: unknown, userId: string): Promise<CapPlan> {
  const db = prisma as Db;
  const sub = await Promise.resolve()
    .then(() => db.userSubscription?.findFirst?.({ where: { userId, ...activeSubWhere() }, include: { plan: true }, orderBy: { createdAt: 'desc' } }) ?? null)
    .catch(() => null);
  return sub?.plan?.tier === 'premium' ? 'plus' : 'free';
}

/** Usage-day key for ai_usage_daily.usage_date. r3b on final-5: ONE convention with final-5's limitDayStart (the instant of the
 * last 00:00 Asia/Tashkent, = what setHours(0) gave on the Tashkent VPS), so prod's existing rows keep matching and every
 * reader/writer (ai, limits, billing, users, admin) uses the same key. */
export function usageDayStart(now = new Date()) {
  return limitDayStart(now);
}
/** Next Asia/Tashkent midnight (all daily counters reset then; the UI shows 00:00). */
export function usageResetAt(now = new Date()) { return nextLimitReset(now); }

export const capOf = (caps: PlanCaps, plan: CapPlan, kind: CapKind): number | null => (plan === 'plus' ? caps.plus[kind] : caps.free[kind]);

/** HTTP 429 with {code, kind, plan, limit, plusLimit, resetAt, messages{en,uz,ru}} (PLUS-OFFER Defaults #4). */
export function dailyLimitException(kind: CapKind, plan: CapPlan, caps: PlanCaps, now = new Date(), capped = false) {
  const body = dailyLimitBody(kind, plan, capOf(caps, plan, kind) ?? 0, caps.plus[kind], usageResetAt(now));
  return new HttpException(capped ? { ...body, capped: true } : body, HttpStatus.TOO_MANY_REQUESTS);
}

/** Throws the 429 when `used` has reached the cap. null/0 = no cap. */
export function assertUnderCap(kind: CapKind, plan: CapPlan, caps: PlanCaps, used: number, now = new Date()) {
  const cap = capOf(caps, plan, kind);
  if (cap && used >= cap) throw dailyLimitException(kind, plan, caps, now);
}

/** Lookup decision. Free: AI until free.lookups, then 429. Plus: unlimited AI while plus.lookups is null;
 *  if set, AI until it, then 'dictionary' (no OpenAI) until the hidden hard cap, then 429 (capped). */
export function lookupMode(plan: CapPlan, caps: PlanCaps, used: number, now = new Date()): 'ai' | 'dictionary' {
  const cap = capOf(caps, plan, 'lookups');
  if (!cap || used < cap) return 'ai';
  if (plan === 'plus') {
    const hard = caps.plusLookupHardCap;
    if (hard == null || used < hard) return 'dictionary';
    throw dailyLimitException('lookups', plan, caps, now, true);
  }
  throw dailyLimitException('lookups', plan, caps, now);
}
