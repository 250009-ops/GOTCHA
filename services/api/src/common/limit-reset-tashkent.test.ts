/** Round-3b: EVERY limit resets at 00:00 Asia/Tashkent (UTC+5, no DST): daily caps at midnight, monthly import pages at midnight on the 1st.
 *  Covers the shared reset helper, the AI usage day, the TTS counter, the free-import day/month/year windows, the 429 resetAt,
 *  and scans shipped source + user-facing copy for any leftover UTC-midnight / 05:00 reset. */
import * as assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { nextLimitReset, limitDayStart, limitResetLine, PAY_COPY } from '@gotcha/shared';
import { usageDayStart, usageResetAt } from './plan-caps';
import { DailyCounter } from '../modules/ai/ai-safety';
import { ImportCommerceService } from '../modules/billing/import-commerce.service';

const MIDNIGHT_1NOV = '2026-10-31T19:00:00.000Z'; // 1 Nov 2026 00:00 Tashkent
// Daily: just before / at / after Tashkent midnight, and at the old UTC-midnight (05:00 Tashkent) instant.
assert.equal(nextLimitReset(new Date('2026-10-31T18:59:59Z')).toISOString(), MIDNIGHT_1NOV);
assert.equal(nextLimitReset(new Date('2026-10-31T10:00:00Z')).toISOString(), MIDNIGHT_1NOV);
assert.equal(nextLimitReset(new Date('2026-10-31T19:00:00Z')).toISOString(), '2026-11-01T19:00:00.000Z');
assert.equal(nextLimitReset(new Date('2026-11-01T00:00:00Z')).toISOString(), '2026-11-01T19:00:00.000Z', '05:00 Tashkent is NOT a reset');
assert.equal(usageResetAt(new Date('2026-10-31T12:00:00Z')).toISOString(), MIDNIGHT_1NOV);
assert.equal(limitDayStart(new Date('2026-10-31T19:30:00Z')).toISOString(), MIDNIGHT_1NOV);
assert.equal(usageDayStart(new Date('2026-10-31T18:59:59Z')).toISOString().slice(0, 10), '2026-10-31');
assert.equal(usageDayStart(new Date('2026-10-31T19:00:00Z')).toISOString().slice(0, 10), '2026-11-01');
for (const l of ['en', 'ru', 'uz']) assert.match(limitResetLine(MIDNIGHT_1NOV, l), /00:00/);

// TTS daily counter (was UTC day): new day at 00:00 Tashkent, not at 00:00Z.
const tts = new DailyCounter(() => 1);
tts.hit('u', new Date('2026-10-31T18:00:00Z'));
assert.throws(() => tts.hit('u', new Date('2026-10-31T18:59:59Z')));
tts.hit('u', new Date('2026-10-31T19:00:00Z'));
assert.throws(() => tts.hit('u', new Date('2026-11-01T00:30:00Z')), 'no second reset at 00:00Z / 05:00 Tashkent');

// Free imports: daily window at midnight, monthly pages at midnight on the 1st, yearly 1 Jan, all Tashkent.
const s: any = Object.create(ImportCommerceService.prototype);
assert.equal(s.startOfTashkentDay(new Date('2026-11-01T04:59:00Z')).toISOString(), MIDNIGHT_1NOV);
assert.equal(s.startOfTashkentMonth(new Date('2026-11-01T04:59:00Z')).toISOString(), MIDNIGHT_1NOV, 'pages reset at 00:00 on the 1st');
assert.equal(s.startOfTashkentMonth(new Date('2026-10-31T18:59:59Z')).toISOString(), '2026-09-30T19:00:00.000Z');
assert.equal(s.startOfTashkentYear(new Date('2027-01-01T00:00:00Z')).toISOString(), '2026-12-31T19:00:00.000Z');

// Copy: the import-pages reset line (pay-copy.json imp.cap.pre.reset) says 00:00 Tashkent on the 1st; no 05:00 / UTC anywhere in pay copy.
for (const l of ['en', 'ru', 'uz'] as const) {
  const c = PAY_COPY[l] as Record<string, string>;
  assert.match(c['imp.cap.pre.reset'], /00:00/);
  assert.match(c['imp.cap.pre.reset'], /1/);
  for (const [k, v] of Object.entries(c)) assert.ok(!/05[:.]00|\bUTC\b|GMT/.test(v), `${l} ${k}`);
}

// Source scan: no UTC-midnight or 05:00 reset left in shipped code or strings (tests excluded).
const root = join(__dirname, '..', '..', '..', '..');
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); if (/node_modules|dist|\.cache/.test(f)) return []; return statSync(p).isDirectory() ? walk(p) : [p]; });
const dirs = ['services/api/src', 'packages/shared/src', 'apps/web-learner/src'].map((d) => join(root, d));
const bad: string[] = [];
for (const f of dirs.flatMap(walk).filter((p) => /\.(ts|tsx|json)$/.test(p) && !/\.test\.|\.spec\./.test(p))) {
  readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
    if (!/@db\.Date/.test(line) && /05[:.]00\s*(Tashkent|Toshkent|по Ташкенту)|UTC midnight|midnight UTC|reset[^\n]*\bUTC\b|\bUTC\b[^\n]*reset/i.test(line)) bad.push(`${f}:${i + 1}: ${line.trim().slice(0, 120)}`);
  });
}
assert.deepEqual(bad, [], 'UTC / 05:00 reset left:\n' + bad.join('\n'));
console.log('limit-reset-tashkent: OK');

// WLF-20: QA saw usage_date stored as the previous day (19:00Z instant in a DATE column). The key is now the Tashkent date.
assert.equal(usageDayStart(new Date('2026-10-31T10:00:00Z')).toISOString(), '2026-10-31T00:00:00.000Z', 'Oct 31 15:00 Tashkent → usage_date 2026-10-31');
