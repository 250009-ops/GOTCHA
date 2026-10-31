// Daily caps (payments-02): the API answers HTTP 429 {code, kind, plan, limit, resetAt, messages}. The UI shows a
// friendly notice (PLUS-OFFER Defaults #4 + the reset time in the user's timezone), never an error toast or raw 429.
import { LIMIT_TIME_ZONE, dailyLimitMessage, limitResetLine, type CapKind, type CapPlan } from '@gotcha/shared';

export type DailyLimitInfo = { kind: CapKind; plan: CapPlan; limit: number; plusLimit: number | null; resetAt: string };
export const DAILY_LIMIT_EVENT = 'gotcha:daily-limit';

export function isDailyLimitError(e: unknown): e is Error & { dailyLimit: DailyLimitInfo } {
  return !!(e && typeof e === 'object' && (e as { dailyLimit?: unknown }).dailyLimit);
}

/** User timezone; Asia/Tashkent when unknown. */
export function userTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || LIMIT_TIME_ZONE; } catch { return LIMIT_TIME_ZONE; }
}

export function dailyLimitText(info: DailyLimitInfo, lang: string, tz: string = userTimeZone()) {
  return {
    message: dailyLimitMessage(info.kind, info.plan, info.limit, info.plusLimit, lang),
    reset: limitResetLine(info.resetAt, lang, tz),
    /** Free users only; never shown to Plus. */
    upsell: info.plan === 'free' && info.kind === 'lookups',
  };
}

export function announceDailyLimit(info: DailyLimitInfo) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent<DailyLimitInfo>(DAILY_LIMIT_EVENT, { detail: info }));
}

/** Silent speed guard (429 lookup_slow_down): neutral note, never an error or a ban. */
export function isSlowDownError(e: unknown): boolean {
  return !!(e && typeof e === 'object' && (e as { code?: string }).code === 'lookup_slow_down');
}

/** Screen 16 heading (pay-copy.json lim.title). */
export function limitTitle(lang: string): string {
  return lang === 'uz' ? 'Kunlik limitlar' : lang === 'ru' ? 'Дневные лимиты' : 'Daily limits';
}

