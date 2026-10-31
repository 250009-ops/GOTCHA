/**
 * Web Plus pass (one-off, NOT recurring): Atmos charge → EntitlementKind.plus with an expiry.
 * Decision relayed by Kai (CEO agent) on 2026-10-31 13:31 UTC+5 as Sarvarbek's: "Plus is sold on the web".
 * Behind WEB_PLUS_PASS (off by default). No auto-renew.
 * Prices: option C, relayed by Kai as Sarvarbek's approval at 13:34 UTC+5 on 31 Oct 2026: 24,990 soʻm / 30 days,
 * 199,990 soʻm / 365 days. These are DEFAULTS only; admin edits them (PlatformSetting keys below), env can override.
 *
 * Precedence: PlatformSetting (admin) > env > default.
 *   WEB_PLUS_PASS                 'true' to enable (env only)
 *   plus.pass.price_30_uzs        / env PLUS_PASS_30_PRICE_UZS   (default 24990)
 *   plus.pass.price_365_uzs       / env PLUS_PASS_365_PRICE_UZS  (default 199990)
 *   plus.benefits                 / env PLUS_BENEFITS_JSON {"importDiscountPct":50,"freeImportMaxPages":0,"bookDiscountPct":0} (importDiscountPct default 50: Sarvarbek 13:57)
 *   env PLUS_REMINDER_DAYS        comma list, default "3,1,0" (0 = on the day it ends)
 */
export type PlusPassDays = 30 | 365;
export const PLUS_PASS_DAYS: PlusPassDays[] = [30, 365];
export const PLUS_ACCOUNT_PREFIX = 'plus_';
/** G1: version of the Public Offer (/oferta, PM pending-payments-02 text) accepted at Plus checkout; bump when the oferta changes. */
export const OFERTA_VERSION = 'oferta-2026-10-31.payments-02';
export const PLUS_FORMAT_PREFIX = 'plus_pass:';

/** Sarvarbek 13:57 'Make the Plus import discount 50%'. Admin-editable via plus.benefits. */
export const PLUS_DEFAULT_IMPORT_DISCOUNT_PCT = 50;
export type PlusBenefits = { importDiscountPct: number; freeImportMaxPages: number; bookDiscountPct: number };
export type PlusPassConfig = {
  enabled: boolean;
  plans: Array<{ days: PlusPassDays; priceUzs: number; sku: string }>;
  benefits: PlusBenefits;
  reminderDays: number[];
};

const truthy = (v: string | undefined) => ['1', 'true', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase());
const pct = (n: unknown) => Math.min(70, Math.max(0, Math.floor(Number(n) || 0)));

export const PLUS_DEFAULT_PRICES: Record<PlusPassDays, number> = { 30: 24990, 365: 199990 };
export const PLUS_SETTING_KEYS = { price30: 'plus.pass.price_30_uzs', price365: 'plus.pass.price_365_uzs', benefits: 'plus.benefits' } as const;

export function plusPassConfig(
  env: Record<string, string | undefined> = process.env,
  minSom = 500,
  settings: Partial<Record<string, unknown>> = {},
): PlusPassConfig {
  let b: Partial<PlusBenefits> = {};
  const rawB = settings[PLUS_SETTING_KEYS.benefits] ?? env.PLUS_BENEFITS_JSON;
  try { b = typeof rawB === 'string' ? JSON.parse(rawB || '{}') : ((rawB as Partial<PlusBenefits>) ?? {}); } catch { b = {}; }
  const price = (days: PlusPassDays) => {
    const fromAdmin = Number(settings[days === 30 ? PLUS_SETTING_KEYS.price30 : PLUS_SETTING_KEYS.price365]);
    if (Number.isFinite(fromAdmin) && fromAdmin > 0) return Math.round(fromAdmin);
    const fromEnv = Number(env[`PLUS_PASS_${days}_PRICE_UZS`]);
    return Number.isFinite(fromEnv) && fromEnv > 0 ? Math.round(fromEnv) : PLUS_DEFAULT_PRICES[days];
  };
  const plans = PLUS_PASS_DAYS.map((days) => ({ days, priceUzs: price(days), sku: `plus_pass_${days}` })).filter((p) => p.priceUzs >= minSom);
  const reminderDays = String(env.PLUS_REMINDER_DAYS ?? '3,1,0').split(',').map((x) => Math.floor(Number(x))).filter((n) => n >= 0 && n <= 60);
  return {
    enabled: truthy(env.WEB_PLUS_PASS),
    plans,
    benefits: {
      importDiscountPct: b.importDiscountPct === undefined ? PLUS_DEFAULT_IMPORT_DISCOUNT_PCT : pct(b.importDiscountPct),
      freeImportMaxPages: Math.max(0, Math.floor(Number(b.freeImportMaxPages) || 0)),
      bookDiscountPct: pct(b.bookDiscountPct),
    },
    reminderDays: [...new Set(reminderDays)].sort((x, y) => y - x),
  };
}

export const plusPassFormat = (days: PlusPassDays) => `${PLUS_FORMAT_PREFIX}${days}`;
export function plusPassDaysFromFormat(format: string | null | undefined): PlusPassDays | null {
  if (!format?.startsWith(PLUS_FORMAT_PREFIX)) return null;
  const d = Number(format.slice(PLUS_FORMAT_PREFIX.length));
  return d === 30 || d === 365 ? d : null;
}

/** Stack on top of an active pass: new expiry = max(now, current) + days. */
export function plusPassExpiry(currentExpiry: Date | null | undefined, days: PlusPassDays, now = new Date()): Date {
  const base = currentExpiry && currentExpiry > now ? currentExpiry : now;
  return new Date(base.getTime() + days * 86_400_000);
}

/** Percent discount for Plus; never below the Atmos minimum, and 0 stays 0. */
export function plusDiscountTiyins(amountTiyins: number, discountPct: number, minTiyins: number): number {
  if (amountTiyins <= 0 || discountPct <= 0) return 0;
  const raw = Math.floor((amountTiyins * pct(discountPct)) / 100);
  return Math.max(0, Math.min(raw, amountTiyins - minTiyins));
}

const tashkentDay = (d: Date) => new Date(d.getTime() + 5 * 3_600_000).toISOString().slice(0, 10);

/**
 * Which reminder is due, or null: 0 = it ends today (Asia/Tashkent calendar day), otherwise the smallest
 * N-days-before threshold already crossed. Dedupe per threshold is the caller's job.
 */
export function dueReminder(expiresAt: Date, reminderDays: number[], now = new Date()): number | null {
  const left = (expiresAt.getTime() - now.getTime()) / 86_400_000;
  if (left <= 0) return null;
  if (reminderDays.includes(0) && tashkentDay(expiresAt) === tashkentDay(now)) return 0;
  const crossed = reminderDays.filter((d) => d > 0 && left <= d);
  return crossed.length ? Math.min(...crossed) : null;
}

/** Overlap rule: Play and a web pass can both be active; the later end date wins (null = open-ended). */
export function laterEnd(a: Date | null | undefined, b: Date | null | undefined): Date | null {
  if (a === null || b === null) return null;
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

/** Admin grant durations: 7 / 30 / 365 days, or a custom future end date. */
export function adminGrantEnd(input: { days?: number | string | null; until?: string | null }, now = new Date()): Date {
  if (input.until) {
    const d = new Date(input.until);
    if (Number.isNaN(d.getTime()) || d <= now) throw new Error('Custom end date must be in the future.');
    if (d.getTime() - now.getTime() > 3 * 366 * 86_400_000) throw new Error('Custom end date is too far ahead.');
    return d;
  }
  const days = Number(input.days ?? 30);
  if (![7, 30, 365].includes(days)) throw new Error('Grant must be 7, 30 or 365 days, or a custom date.');
  return new Date(now.getTime() + days * 86_400_000);
}

/** PRICING.md rule 6: the TOTAL discount (Plus + promo, combined) never exceeds 70 %, and the charge never drops below the Atmos minimum. */
export const MAX_TOTAL_DISCOUNT_PCT = 70;
export function capTotalDiscountTiyins(listTiyins: number, discountTiyins: number, minTiyins: number): number {
  if (listTiyins <= 0 || discountTiyins <= 0) return 0;
  const cap = Math.floor((listTiyins * MAX_TOTAL_DISCOUNT_PCT) / 100);
  return Math.max(0, Math.min(discountTiyins, cap, listTiyins - minTiyins));
}
