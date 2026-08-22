import * as assert from 'node:assert/strict';
import {
  calendarDateKey,
  dateFromCalendarKey,
  diffCalendarDays,
  effectiveStreakCount,
  nextStreakState,
  streakFromActivityDays,
} from './streak.service';

const TZ = 'Asia/Tashkent';

// 10:30 Tashkent on 19 Aug 2026
const morning = new Date('2026-08-19T05:30:00.000Z');
// 00:15 Tashkent on 19 Aug 2026 (still 18 Aug UTC)
const justAfterMidnight = new Date('2026-08-18T19:15:00.000Z');
const storedToday = dateFromCalendarKey('2026-08-19');
const storedYesterday = dateFromCalendarKey('2026-08-18');

assert.equal(calendarDateKey(morning, TZ), '2026-08-19');
assert.equal(calendarDateKey(justAfterMidnight, TZ), '2026-08-19');
assert.equal(calendarDateKey(storedToday, TZ), '2026-08-19');

assert.equal(diffCalendarDays(storedToday, morning, TZ), 0);
assert.equal(diffCalendarDays(storedYesterday, morning, TZ), 1);
assert.equal(diffCalendarDays(dateFromCalendarKey('2026-08-17'), morning, TZ), 2);

// Same calendar day must not increment — this is the production bug.
const sameDayAgain = nextStreakState(1, storedToday, morning, TZ);
assert.equal(sameDayAgain.streakCount, 1);
assert.equal(sameDayAgain.streakLastDate.toISOString().slice(0, 10), '2026-08-19');

const twentySaves = Array.from({ length: 20 }).reduce((count) => {
  return nextStreakState(count, storedToday, morning, TZ).streakCount;
}, 1);
assert.equal(twentySaves, 1, 'autosave every 20s must not grow the streak');

const nextDay = nextStreakState(1, storedToday, new Date('2026-08-20T05:00:00.000Z'), TZ);
assert.equal(nextDay.streakCount, 2);

const afterGap = nextStreakState(7, storedToday, new Date('2026-08-22T05:00:00.000Z'), TZ);
assert.equal(afterGap.streakCount, 1);

const firstRead = nextStreakState(0, null, morning, TZ);
assert.equal(firstRead.streakCount, 1);

assert.equal(effectiveStreakCount(19, storedToday, morning, TZ), 19);
assert.equal(effectiveStreakCount(19, dateFromCalendarKey('2026-08-17'), morning, TZ), 0);

const repaired = streakFromActivityDays(['2026-08-19', '2026-08-19'], morning, TZ);
assert.equal(repaired.streakCount, 1);
assert.equal(repaired.streakLastDate?.toISOString().slice(0, 10), '2026-08-19');

const twoDays = streakFromActivityDays(['2026-08-18', '2026-08-19'], morning, TZ);
assert.equal(twoDays.streakCount, 2);

const stale = streakFromActivityDays(['2026-08-10', '2026-08-11'], morning, TZ);
assert.equal(stale.streakCount, 0);

console.log('streak.service.test.ts ok');
