import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tashkentDayStart, tashkentMonthStart, tashkentYearStart } from './tashkent-window';

// 31 Oct 2026 21:30 Tashkent = 16:30Z; 1 Nov 00:30 Tashkent = 31 Oct 19:30Z (UTC still says October).
assert.equal(tashkentDayStart(new Date('2026-10-31T16:30:00Z')).toISOString(), '2026-10-30T19:00:00.000Z');
assert.equal(tashkentDayStart(new Date('2026-10-31T19:30:00Z')).toISOString(), '2026-10-31T19:00:00.000Z');
assert.equal(tashkentDayStart(new Date('2026-10-31T18:59:59Z')).toISOString(), '2026-10-30T19:00:00.000Z');
assert.equal(tashkentMonthStart(new Date('2026-10-31T19:30:00Z')).toISOString(), '2026-10-31T19:00:00.000Z'); // November in Tashkent
assert.equal(tashkentMonthStart(new Date('2026-10-31T18:00:00Z')).toISOString(), '2026-09-30T19:00:00.000Z'); // still October
assert.equal(tashkentMonthStart(new Date('2026-10-31T19:30:00Z'), -11).toISOString(), '2025-11-30T19:00:00.000Z'); // 12m range
assert.equal(tashkentMonthStart(new Date('2026-10-31T19:30:00Z'), -23).toISOString(), '2024-11-30T19:00:00.000Z'); // prior 12m
assert.equal(tashkentYearStart(new Date('2026-12-31T19:30:00Z')).toISOString(), '2026-12-31T19:00:00.000Z'); // 1 Jan 2027 Tashkent
assert.equal(tashkentYearStart(new Date('2026-12-31T18:59:00Z')).toISOString(), '2025-12-31T19:00:00.000Z');

// Admin report windows (importPricing, levelTests) and the import windows use Tashkent, not UTC midnight.
const fn = (src: string, name: string) => { const i = src.indexOf(`async ${name}(`); return src.slice(i, src.indexOf('\n  async ', i + 10)); };
const admin = readFileSync(join(__dirname, '../modules/admin/admin.service.ts'), 'utf8');
for (const n of ['importPricing', 'levelTests']) {
  const body = fn(admin, n);
  assert.ok(body.length > 50, n);
  assert.ok(!/setUTCHours\(0|Date\.UTC\(/.test(body), `${n} still uses a UTC window`);
  assert.match(body, /tashkent(Day|Month)Start\(/, n);
}
const ic = readFileSync(join(__dirname, '../modules/billing/import-commerce.service.ts'), 'utf8');
assert.ok(!/startOfUtc|UTC midnight|setUTCHours\(0/.test(ic), 'import-commerce: no UTC windows or out-of-date comments');
assert.match(ic, /if \(resetCycle === 'yearly'\) return this\.startOfTashkentYear\(\)/);
console.log('tashkent-window: OK');
