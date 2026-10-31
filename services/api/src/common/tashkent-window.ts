/** r3b: report and limit windows start at 00:00 Asia/Tashkent (UTC+5 all year, no DST), never at UTC midnight (05:00 Tashkent). */
export const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
/** 00:00 Tashkent of the calendar day containing `now`. */
export function tashkentDayStart(now = new Date()): Date {
  const t = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - TASHKENT_OFFSET_MS);
}
/** 00:00 Tashkent on the 1st of the Tashkent month of `now`, shifted by `deltaMonths` (e.g. -2 = two months earlier). */
export function tashkentMonthStart(now = new Date(), deltaMonths = 0): Date {
  const t = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + deltaMonths, 1) - TASHKENT_OFFSET_MS);
}
/** 00:00 Tashkent on 1 January of the Tashkent year of `now`. */
export function tashkentYearStart(now = new Date()): Date {
  const t = new Date(now.getTime() + TASHKENT_OFFSET_MS);
  return new Date(Date.UTC(t.getUTCFullYear(), 0, 1) - TASHKENT_OFFSET_MS);
}
