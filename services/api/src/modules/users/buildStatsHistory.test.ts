import * as assert from 'node:assert/strict';
import { buildStatsHistory } from './users.service';
import {
  shouldCreditStreakToday,
  streakQualifyingMinutes,
} from '../../services/streak.service';

const day = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

// WL4-13: dates relative to today so the 30-day window never drifts past them.
const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const D1 = isoDaysAgo(5);
const D2 = isoDaysAgo(4);

const contentA = '11111111-1111-1111-1111-111111111111';
const contentB = '22222222-2222-2222-2222-222222222222';

const { history } = buildStatsHistory(
  [
    { startedAt: day(D1), durationSeconds: 600, contentId: contentA },
    { startedAt: day(D1), durationSeconds: 300, contentId: contentA },
    { startedAt: day(D2), durationSeconds: 300, contentId: contentB },
  ],
  [{ createdAt: day(D1) }, { createdAt: day(D2) }, { createdAt: day(D2) }],
  [
    {
      contentId: contentA,
      completedAt: day(D1),
      lastReadAt: day(D1),
    },
  ],
  30,
);

const byDate = new Map(history.daily.map((d) => [d.date, d]));
assert.equal(byDate.get(D1)?.minutes, 15);
assert.equal(byDate.get(D2)?.minutes, 5);
assert.equal(byDate.get(D1)?.wordsSaved, 1);
assert.equal(byDate.get(D2)?.wordsSaved, 2);

const heatByDate = new Map(history.heatmap.map((d) => [d.date, d]));
assert.equal(heatByDate.get(D1)?.count, 1, 'duplicate session slices dedupe to one content');
assert.equal(heatByDate.get(D2)?.count, 1);
assert.equal(heatByDate.get(D1)?.finished, 1);

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
