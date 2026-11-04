/** final-5 (Kai): ALL resets at 00:00 Asia/Tashkent: daily lookups/quizzes at midnight, monthly import pages at midnight on the 1st. */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { limitDayStart, limitMonthStart, nextLimitResetAt, nextMonthlyResetAt, dailyLimitBody } from './plan-limits';

const iso = (d: Date) => d.toISOString();
// 23:59 Tashkent on 31 Oct = 18:59Z; 00:01 Tashkent on 1 Nov = 19:01Z
assert.equal(iso(limitDayStart(new Date('2026-10-31T18:59:00Z'))), '2026-10-30T19:00:00.000Z', '31 Oct 00:00 Tashkent');
assert.equal(iso(nextLimitResetAt(new Date('2026-10-31T18:59:00Z'))), '2026-10-31T19:00:00.000Z', 'next reset = 1 Nov 00:00 Tashkent');
assert.equal(iso(limitDayStart(new Date('2026-10-31T19:01:00Z'))), '2026-10-31T19:00:00.000Z');
// 03:00 Tashkent (22:00Z prev day) is already the new day; 04:59 Tashkent still the same day as 00:00 (no 05:00 reset)
assert.equal(iso(limitDayStart(new Date('2026-11-04T23:59:00Z'))), '2026-11-04T19:00:00.000Z');
// monthly: 1st at 00:00 Tashkent
assert.equal(iso(limitMonthStart(new Date('2026-10-31T18:59:00Z'))), '2026-09-30T19:00:00.000Z', 'Oct 1 00:00 Tashkent');
assert.equal(iso(limitMonthStart(new Date('2026-10-31T19:00:00Z'))), '2026-10-31T19:00:00.000Z', 'Nov 1 00:00 Tashkent');
assert.equal(iso(nextMonthlyResetAt(new Date('2026-12-15T10:00:00Z'))), '2026-12-31T19:00:00.000Z', 'Jan 1 00:00 Tashkent');
const b = dailyLimitBody('lookup', 20, new Date('2026-10-31T10:00:00Z'));
assert.equal(b.resetAt, '2026-10-31T19:00:00.000Z'); assert.equal(b.timezone, 'Asia/Tashkent');
// no 05:00 / UTC-midnight reset left in limit code or copy
const scan = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n); if (statSync(p).isDirectory()) return scan(p);
  return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
});
for (const f of scan(join(__dirname, '..'))) {
  const s = readFileSync(f, 'utf8');
  assert.ok(!/05:00|startOfUtcDay\(\)|startOfUtcMonth\(\)/.test(s), `${f}: 05:00 / UTC-midnight reset`);
}
console.log('tashkent-reset.test: OK (daily + monthly resets at 00:00 Asia/Tashkent; no 05:00)');
