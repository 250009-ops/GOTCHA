import * as assert from 'node:assert/strict';
import { buildStatsHistory } from './users.service';
import {
  shouldCreditStreakToday,
  streakQualifyingMinutes,
} from '../../services/streak.service';

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

const contentA = '11111111-1111-1111-1111-111111111111';
const contentB = '22222222-2222-2222-2222-222222222222';

const { history } = buildStatsHistory(
  [
    { startedAt: day('2026-08-20'), durationSeconds: 600, contentId: contentA },
    { startedAt: day('2026-08-20'), durationSeconds: 300, contentId: contentA },
    { startedAt: day('2026-08-21'), durationSeconds: 300, contentId: contentB },
  ],
  [{ createdAt: day('2026-08-20') }, { createdAt: day('2026-08-21') }, { createdAt: day('2026-08-21') }],
  [
    {
      contentId: contentA,
      completedAt: day('2026-08-20'),
      lastReadAt: day('2026-08-20'),
    },
  ],
  30,
  day('2026-08-22'), // fixed clock so the 30-day window always contains the fixtures
);

const byDate = new Map(history.daily.map((d) => [d.date, d]));
assert.equal(byDate.get('2026-08-20')?.minutes, 15);
assert.equal(byDate.get('2026-08-21')?.minutes, 5);
assert.equal(byDate.get('2026-08-20')?.wordsSaved, 1);
assert.equal(byDate.get('2026-08-21')?.wordsSaved, 2);

const heatByDate = new Map(history.heatmap.map((d) => [d.date, d]));
assert.equal(heatByDate.get('2026-08-20')?.count, 1, 'duplicate session slices dedupe to one content');
assert.equal(heatByDate.get('2026-08-21')?.count, 1);
assert.equal(heatByDate.get('2026-08-20')?.finished, 1);

assert.equal(streakQualifyingMinutes(15), 15);
assert.equal(streakQualifyingMinutes(undefined), 15);
assert.equal(streakQualifyingMinutes(5), 5);

assert.equal(
  shouldCreditStreakToday({
    todayReadSeconds: 14 * 60,
    qualifyingMinutes: 15,
    streakLastDate: null,
    now: day('2026-08-22'),
  }),
  false,
);

assert.equal(
  shouldCreditStreakToday({
    todayReadSeconds: 15 * 60,
    qualifyingMinutes: 15,
    streakLastDate: null,
    now: day('2026-08-22'),
  }),
  true,
);

assert.equal(
  shouldCreditStreakToday({
    todayReadSeconds: 60 * 60,
    qualifyingMinutes: 15,
    streakLastDate: day('2026-08-22'),
    now: day('2026-08-22'),
  }),
  false,
  'already credited today',
);

console.log('buildStatsHistory.test.ts ok');
