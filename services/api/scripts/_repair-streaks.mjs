/**
 * Recalculate User.streakCount from unique reading days.
 * Fixes the Asia/Tashkent + Prisma DATE bug that incremented on every progress save.
 */
import { PrismaClient } from '@prisma/client';

const TZ = process.env.APP_TIMEZONE || 'Asia/Tashkent';

function calendarDateKey(value, timeZone = TZ) {
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function dateFromCalendarKey(key) {
  return new Date(`${key}T00:00:00.000Z`);
}

function streakFromActivityDays(dayKeys, now = new Date()) {
  const unique = [...new Set(dayKeys.filter(Boolean))].sort();
  if (!unique.length) return { streakCount: 0, streakLastDate: null };

  const last = unique[unique.length - 1];
  let count = 1;
  for (let i = unique.length - 1; i > 0; i--) {
    const newer = Date.parse(`${unique[i]}T00:00:00.000Z`);
    const older = Date.parse(`${unique[i - 1]}T00:00:00.000Z`);
    if (Math.round((newer - older) / 86_400_000) === 1) count += 1;
    else break;
  }

  const today = calendarDateKey(now);
  const yesterday = calendarDateKey(new Date(dateFromCalendarKey(today).getTime() - 86_400_000));
  if (last !== today && last !== yesterday) {
    return { streakCount: 0, streakLastDate: dateFromCalendarKey(last) };
  }
  return { streakCount: count, streakLastDate: dateFromCalendarKey(last) };
}

const dryRun = process.argv.includes('--dry-run');
const p = new PrismaClient();

const users = await p.user.findMany({
  select: {
    id: true,
    email: true,
    displayName: true,
    createdAt: true,
    streakCount: true,
    streakLastDate: true,
    readingProgress: { select: { lastReadAt: true } },
    readingSessions: { select: { startedAt: true } },
  },
});

const now = new Date();
let changed = 0;
for (const u of users) {
  const days = [
    ...u.readingProgress.map((r) => (r.lastReadAt ? calendarDateKey(r.lastReadAt) : '')),
    ...u.readingSessions.map((s) => calendarDateKey(s.startedAt)),
  ];
  const next = streakFromActivityDays(days, now);
  const sameCount = next.streakCount === u.streakCount;
  const sameDate =
    (next.streakLastDate?.toISOString().slice(0, 10) ?? null) ===
    (u.streakLastDate ? u.streakLastDate.toISOString().slice(0, 10) : null);
  if (sameCount && sameDate) continue;

  changed += 1;
  console.log(
    JSON.stringify({
      email: u.email,
      name: u.displayName,
      before: { streakCount: u.streakCount, streakLastDate: u.streakLastDate },
      after: next,
      activityDays: [...new Set(days.filter(Boolean))].sort(),
    }),
  );
  if (!dryRun) {
    await p.user.update({
      where: { id: u.id },
      data: { streakCount: next.streakCount, streakLastDate: next.streakLastDate },
    });
  }
}

console.log(dryRun ? `DRY_RUN would update ${changed} users` : `updated ${changed} users`);
await p.$disconnect();
