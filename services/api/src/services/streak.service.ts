import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Product calendar for streaks — learners are in UZ; the VPS is Asia/Tashkent. */
export const STREAK_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Tashkent';

/** YYYY-MM-DD in the streak timezone. */
export function calendarDateKey(
  value: Date | string = new Date(),
  timeZone = STREAK_TIMEZONE,
): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Prisma `@db.Date` round-trip: UTC midnight of that calendar key. */
export function dateFromCalendarKey(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function diffCalendarDays(
  from: Date | string,
  to: Date | string = new Date(),
  timeZone = STREAK_TIMEZONE,
): number {
  const a = dateFromCalendarKey(calendarDateKey(from, timeZone)).getTime();
  const b = dateFromCalendarKey(calendarDateKey(to, timeZone)).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function nextStreakState(
  prevCount: number,
  prevLast: Date | string | null | undefined,
  now: Date | string = new Date(),
  timeZone = STREAK_TIMEZONE,
): { streakCount: number; streakLastDate: Date } {
  const todayKey = calendarDateKey(now, timeZone);
  const streakLastDate = dateFromCalendarKey(todayKey);
  if (!prevLast) {
    return { streakCount: 1, streakLastDate };
  }
  const diffDays = diffCalendarDays(prevLast, now, timeZone);
  if (diffDays === 0) {
    return { streakCount: prevCount > 0 ? prevCount : 1, streakLastDate };
  }
  if (diffDays === 1) {
    return { streakCount: (prevCount > 0 ? prevCount : 0) + 1, streakLastDate };
  }
  return { streakCount: 1, streakLastDate };
}

/** Current streak for display: alive if last activity was today or yesterday. */
export function effectiveStreakCount(
  streakCount: number,
  streakLastDate: Date | string | null | undefined,
  now: Date | string = new Date(),
  timeZone = STREAK_TIMEZONE,
): number {
  if (!streakCount || !streakLastDate) return 0;
  const diffDays = diffCalendarDays(streakLastDate, now, timeZone);
  if (diffDays <= 1) return streakCount;
  return 0;
}

/**
 * Rebuild a streak from unique activity calendar days (newest last).
 * Used to repair counts inflated by the old local-midnight DATE bug.
 */
export function streakFromActivityDays(
  dayKeys: string[],
  now: Date | string = new Date(),
  timeZone = STREAK_TIMEZONE,
): { streakCount: number; streakLastDate: Date | null } {
  const unique = [...new Set(dayKeys.filter(Boolean))].sort();
  if (!unique.length) return { streakCount: 0, streakLastDate: null };

  const last = unique[unique.length - 1];
  let count = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    const newer = unique[i];
    const older = unique[i - 1];
    if (diffCalendarDays(dateFromCalendarKey(older), dateFromCalendarKey(newer), timeZone) === 1) {
      count += 1;
    } else {
      break;
    }
  }

  const today = calendarDateKey(now, timeZone);
  const yesterday = calendarDateKey(new Date(dateFromCalendarKey(today).getTime() - 86_400_000), timeZone);
  if (last !== today && last !== yesterday) {
    return { streakCount: 0, streakLastDate: dateFromCalendarKey(last) };
  }
  return { streakCount: count, streakLastDate: dateFromCalendarKey(last) };
}

@Injectable()
export class StreakService {
  constructor(private prisma: PrismaService) {}

  async recordActivity(userId: string, minutesRead = 0) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const { streakCount, streakLastDate } = nextStreakState(
      user.streakCount,
      user.streakLastDate,
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        streakCount,
        streakLastDate,
      },
    });

    return { streakCount, minutesRead };
  }
}
