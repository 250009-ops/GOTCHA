// Daily caps (Sarvarbek 14:18/14:32): Free 20 lookups + 10 quizzes; Plus no daily lookup cap by default (config) + 200 quizzes. Values live in the DB
// (subscription_plans.ai_daily_quota / quiz_daily_quota, admin-editable); these are only fallbacks.
// Limit-hit text: PLUS-OFFER.md Defaults #4, verbatim with N = the enforced cap.

import { PAY_COPY } from './payCopy';

export type CapKind = 'lookups' | 'quizzes' | 'mashq';
export type CapPlan = 'free' | 'plus';
export type CapLang = 'en' | 'uz' | 'ru';

/** Code fallbacks when the DB has no value (match the seed). Plus full AI lookups: null = unlimited (Sarvarbek 14:32). */
export const DAILY_CAP_FALLBACKS: { free: { lookups: number; quizzes: number; mashq: number }; plus: { lookups: number | null; quizzes: number; mashq: number | null } } = {
  free: { lookups: 20, quizzes: 10, mashq: 20 },
  plus: { lookups: null, quizzes: 200, mashq: null },
};
/** platform_settings keys (admin config). JSON null / missing = unlimited / no cap. */
/** WLF-12: Free lookups / Free quizzes / Plus quizzes per day live in platform_settings ONLY (never subscription_plans columns). */
/** Mashq: questions/day, separate from the on-click quiz cap. Plus null = no daily cap. */
export const DAILY_CAP_KEYS = {
  freeLookups: 'caps.free.lookups',
  freeQuizzes: 'caps.free.quizzes',
  plusQuizzes: 'caps.plus.quizzes',
  freeMashq: 'caps.free.mashq',
  plusMashq: 'caps.plus.mashq',
} as const;
/** SET-20: the Settings usage card hides Mashq until the §16 question bank is live. */
export const PAGE_QUIZ_BANKS_LIVE = false;
export const MASHQ_BURST_KEYS = { perMinute: 'mashq.burst_per_minute', perHour: 'mashq.burst_per_hour', maxOpenSessions: 'mashq.max_open_sessions' } as const;
export const MASHQ_BURST_FALLBACKS = { perMinute: 60, perHour: 600, maxOpenSessions: 3 } as const;
export const PLUS_AI_LOOKUP_QUOTA_KEY = 'plus.ai_lookup_quota'; // plusAiLookupQuota
export const PLUS_LOOKUP_HARD_CAP_KEY = 'plus.lookup_hard_cap'; // plusLookupHardCap (hidden, never in UI/copy)
export const LOOKUP_BURST_KEYS = { perMinute: 'lookup.burst_per_minute', perHour: 'lookup.burst_per_hour' } as const;
export const LOOKUP_BURST_FALLBACKS = { perMinute: 30, perHour: 300 } as const;
export const LIMIT_TIME_ZONE = 'Asia/Tashkent';

const lang3 = (l: string | null | undefined): CapLang => (l === 'uz' || l === 'ru' ? l : 'en');

/** Screen 16 (PAYMENTS §14/§16, pay-copy.json lim.*, PLUS-OFFER Defaults #4): Free lookups and quizzes (both plans) only.
 *  There is NO Plus lookup limit-hit message (Plus has no lookup cap). If the dormant admin hard cap is ever configured
 *  and hit, Plus gets the neutral speed-guard copy instead (never a number, never an upsell). `plusLimit` is ignored. */
export function dailyLimitMessage(kind: CapKind, plan: CapPlan, limit: number, _plusLimit: number | null, lang: string | null | undefined): string {
  const l = lang3(lang);
  const t = PAY_COPY[l];
  if (kind === 'quizzes') return t['lim.quiz'];
  if (kind === 'mashq') {
    return {
      en: `You've used today's ${limit} free Practice questions`,
      uz: `Bugungi ${limit} ta bepul Mashq savoli tugadi`,
      ru: `${limit} бесплатных вопросов Практики на сегодня закончились`,
    }[l];
  }
  if (plan === 'plus') return SLOW_DOWN_COPY[l];
  return t['lim.free'].replace('{free}', String(limit));
}

/** Next local midnight in `tz` (default Tashkent) as an absolute instant. Uzbekistan has no DST. */
export function nextLimitReset(now: Date = new Date(), tz: string = LIMIT_TIME_ZONE): Date {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const offsetMs = asUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(+p.year, +p.month - 1, +p.day + 1) - offsetMs);
}

/** Start of the current day in `tz`, for the usage counter row (usage_date). */
export function limitDayStart(now: Date = new Date(), tz: string = LIMIT_TIME_ZONE): Date {
  return new Date(nextLimitReset(now, tz).getTime() - 86_400_000);
}

/** "Resets at 00:00 (Tashkent time)" style line, in the user's timezone. */
export function limitResetLine(resetAt: string | Date, lang: string | null | undefined, tz: string = LIMIT_TIME_ZONE): string {
  const t = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(resetAt));
  const zone = tz === LIMIT_TIME_ZONE ? { en: 'Tashkent time', uz: 'Toshkent vaqti', ru: 'по Ташкенту' } : { en: tz, uz: tz, ru: tz };
  const l = lang3(lang);
  return { en: `Resets at ${t} (${zone.en}).`, uz: `${t} da yangilanadi (${zone.uz}).`, ru: `Обновится в ${t} (${zone.ru}).` }[l];
}

/** 429 body the API sends at a cap. The UI renders it as a friendly notice, never an error toast. */
export type DailyLimitBody = { statusCode: 429; code: 'lookup_limit' | 'quiz_limit' | 'mashq_limit'; kind: CapKind; plan: CapPlan; limit: number; plusLimit: number | null; resetAt: string; message: string; messages: Record<CapLang, string> };

/** resetAt = when the counter actually resets (the API's usage-day boundary). */
export function dailyLimitBody(kind: CapKind, plan: CapPlan, limit: number, plusLimit: number | null, resetAt: Date = nextLimitReset()): DailyLimitBody {
  const messages = { en: dailyLimitMessage(kind, plan, limit, plusLimit, 'en'), uz: dailyLimitMessage(kind, plan, limit, plusLimit, 'uz'), ru: dailyLimitMessage(kind, plan, limit, plusLimit, 'ru') };
  const code = kind === 'lookups' ? 'lookup_limit' : kind === 'quizzes' ? 'quiz_limit' : 'mashq_limit';
  return { statusCode: 429, code, kind, plan, limit, plusLimit, resetAt: resetAt.toISOString(), message: messages.en, messages };
}

/** Paywall headline from config (PLUS-OFFER.md §4, 14:33). Never "unlimited" / "fair use" in UI copy. */
export function plusHeadline(plusLookups: number | null, lang: string | null | undefined): string {
  const l = lang3(lang);
  if (plusLookups == null) return { en: 'No fixed daily limit on word lookups with Plus.', uz: 'Plus bilan soʻz izohlari uchun belgilangan kunlik limit yoʻq.', ru: 'С Plus нет фиксированного дневного лимита на пояснения слов.' }[l];
  return { en: `Look up ${plusLookups} words a day with Plus.`, uz: `Plus bilan kuniga ${plusLookups} ta soʻz izohini oling.`, ru: `С Plus: ${plusLookups} пояснений слов в день.` }[l];
}

/** Paywall lookups bullet from config (PLUS-OFFER.md §4). */
export function plusLookupsBullet(plusLookups: number | null, freeLookups: number, lang: string | null | undefined): string {
  const l = lang3(lang);
  if (plusLookups == null) return { en: `No fixed daily limit on word lookups (${freeLookups} a day on Free)`, uz: `Soʻz izohlari uchun belgilangan kunlik limit yoʻq (bepul tarifda kuniga ${freeLookups} ta)`, ru: `Без фиксированного дневного лимита на пояснения слов (в бесплатном плане ${freeLookups} в день)` }[l];
  return { en: `${plusLookups} word lookups a day (${freeLookups} on Free)`, uz: `Kuniga ${plusLookups} ta soʻz izohi (bepul tarifda ${freeLookups} ta)`, ru: `${plusLookups} пояснений слов в день (в бесплатном плане ${freeLookups})` }[l];
}

/** Paywall sub-line from config (PLUS-OFFER.md §4). */
export function plusLead(plusLookups: number | null, freeLookups: number, lang: string | null | undefined): string {
  const l = lang3(lang);
  if (plusLookups == null) return {
    en: `Free gives you ${freeLookups} word lookups a day. Plus has no fixed daily limit on word lookups, so a long chapter won't stop you halfway.`,
    uz: `Bepul tarifda kuniga ${freeLookups} ta soʻz izohi bor. Plusʼda soʻz izohlari uchun belgilangan kunlik limit yoʻq, shuning uchun uzun bob yarmida toʻxtab qolmaysiz.`,
    ru: `В бесплатном плане ${freeLookups} пояснений слов в день. В Plus нет фиксированного дневного лимита на пояснения слов, и длинная глава не оборвётся на середине.`,
  }[l];
  return {
    en: `Free gives you ${freeLookups} word lookups a day. Plus gives you ${plusLookups}, so a long chapter won't stop you halfway.`,
    uz: `Bepul tarifda kuniga ${freeLookups} ta soʻz izohi bor. Plusʼda ${plusLookups} ta, shuning uchun uzun bob yarmida toʻxtab qolmaysiz.`,
    ru: `В бесплатном плане ${freeLookups} пояснений слов в день. В Plus их ${plusLookups}, и длинная глава не оборвётся на середине.`,
  }[l];
}

/** Dictionary mode (PAYMENTS.md §17): copy DROPPED by Marketing (14:33). The server path stays dormant
 *  (only when a Plus AI quota is configured) and the UI shows no dictionary-mode copy. */

/** 24-hour HH:MM of an instant in tz (default Tashkent). */
export function limitClock(at: string | Date, tz: string = LIMIT_TIME_ZONE): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(at));
}

/** Burst guard (silent speed guard, config-driven): friendly, never a ban, never "fair use".
 *  Marketing final copy (verbatim). */
export const SLOW_DOWN_COPY = {
  en: "You're looking up words very quickly. Take a short pause and try again in a minute.",
  uz: 'Soʻzlarni juda tez qidiryapsiz. Biroz kutib, bir daqiqadan soʻng qayta urinib koʻring.',
  ru: 'Вы ищете слова слишком быстро. Подождите немного и попробуйте снова через минуту.',
} as const;
export function slowDownMessage(lang: string | null | undefined): string {
  return SLOW_DOWN_COPY[lang3(lang)];
}
