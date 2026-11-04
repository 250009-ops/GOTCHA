import * as assert from 'node:assert/strict';
import { publicLandingPayload } from './marketing.service';

// Hotfix web1 (AUDIT C4/C6): the public landing payload never carries learner names or counters.
const out = publicLandingPayload({
  generatedAt: '2026-10-30T18:00:00.000Z',
  languages: [],
  catalog: { source: 'recent', items: [] },
  importPricing: {} as never,
});
assert.deepEqual(out.topReaders, []);
assert.deepEqual(out.stats, { learnerCount: 0 });
// Even if a caller smuggles extra fields in, they are overwritten.
const smuggled = publicLandingPayload({
  ...out,
  topReaders: [{ rank: 1, displayName: 'X Y', initials: 'XY', minutesRead: 1, streakDays: 1, wordsLearned: 1 }],
  stats: { learnerCount: 12840 },
} as never);
assert.deepEqual(smuggled.topReaders, []);
assert.equal(smuggled.stats.learnerCount, 0);
assert.ok(!JSON.stringify(smuggled).includes('displayName'));
console.log('marketing public payload tests passed');
