import { TASHKENT_OFFSET_MS, tashkentDayStart } from '../../common/tashkent-window';

/** Hour 0–23 in Asia/Tashkent. */
export function tashkentHour(now = new Date()): number {
  return new Date(now.getTime() + TASHKENT_OFFSET_MS).getUTCHours();
}

/** Bot notifications are not sent from 22:00 through 07:59 Asia/Tashkent. 08:00 is allowed. */
export function inTelegramQuietHours(now = new Date()): boolean {
  const hour = tashkentHour(now);
  return hour >= 22 || hour < 8;
}

export function tashkentDayEnd(now = new Date()): Date {
  return new Date(tashkentDayStart(now).getTime() + 86_400_000);
}

export const TELEGRAM_DAILY_LIMIT = 3;
