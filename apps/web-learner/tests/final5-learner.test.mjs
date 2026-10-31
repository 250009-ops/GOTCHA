// final-5 learner guard: banned copy, Tashkent-midnight resets, payments flag, limit screen.
// Run: npm run build -w packages/shared (or tsc -p packages/shared) && node --test apps/web-learner/tests/final5-learner.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as shared from '../../../packages/shared/dist/index.js';
import { learnerCopyFor } from '../../../packages/shared/dist/learnerCopy.js';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', 'src');
const SHARED = join(here, '..', '..', '..', 'packages', 'shared', 'src');
const LANGS = ['en', 'ru', 'uz'];

function strings(v, out = [], depth = 0) {
  if (depth > 8 || v == null) return out;
  if (typeof v === 'string') out.push(v);
  else if (typeof v === 'function') { try { strings(v(3, 50, 'this month'), out, depth + 1); } catch { /* ignore */ } }
  else if (typeof v === 'object') for (const x of Object.values(v)) strings(x, out, depth + 1);
  return out;
}
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(f)) out.push(p);
  }
  return out;
}
const BANNED = [/unlimited/i, /fair use/i, /offline reading/i, /no monthly fee/i, /unlimited content imports/i,
  /\$/, /200 lookups/i, /05:00/, /безлимит/i, /неограничен/i, /cheksiz/i, /CEFR/, /leaderboard|рейтинг|reyting/i, /Admin tariflari/];

for (const lang of LANGS) {
  test(`banned copy absent (${lang})`, () => {
    const all = [...strings(learnerCopyFor(lang)), ...strings(shared.LIMIT_COPY[lang])];
    assert.ok(all.length > 300);
    for (const s of all) for (const re of BANNED) assert.doesNotMatch(s, re, `${lang}: "${s}"`);
  });
}

test('limit copy says 00:00 Tashkent for daily and the 1st for monthly', () => {
  assert.match(shared.LIMIT_COPY.en.dailyReset, /00:00 Tashkent/);
  assert.match(shared.LIMIT_COPY.ru.dailyReset, /00:00 по ташкентскому/);
  assert.match(shared.LIMIT_COPY.uz.dailyReset, /Toshkent vaqti bilan 00:00/);
  for (const l of LANGS) assert.match(shared.LIMIT_COPY[l].monthlyReset('X'), /00:00/);
  assert.match(shared.LIMIT_COPY.en.importMonthlyBody(50), /all 50 free pages for this month/);
});

test('reset instants are 00:00 Asia/Tashkent (19:00 UTC)', () => {
  const at = (iso) => new Date(iso);
  assert.equal(shared.nextTashkentMidnight(at('2026-10-31T18:59:59Z')).toISOString(), '2026-10-31T19:00:00.000Z');
  assert.equal(shared.nextTashkentMidnight(at('2026-10-31T19:00:00Z')).toISOString(), '2026-11-01T19:00:00.000Z');
  assert.equal(shared.nextTashkentMidnight(at('2026-10-31T04:59:00Z')).toISOString(), '2026-10-31T19:00:00.000Z');
  assert.equal(shared.nextTashkentMonthStart(at('2026-10-31T18:59:59Z')).toISOString(), '2026-10-31T19:00:00.000Z');
  assert.equal(shared.nextTashkentMonthStart(at('2026-10-31T19:00:00Z')).toISOString(), '2026-11-30T19:00:00.000Z');
  assert.equal(shared.nextTashkentMonthStart(at('2026-12-15T10:00:00Z')).toISOString(), '2026-12-31T19:00:00.000Z');
});

test('limit screen notices from API 403 bodies', () => {
  const d = shared.limitNoticeFromError({ code: 'DAILY_LIMIT_REACHED', body: { kind: 'lookup', limit: 20 } }, 'en');
  assert.equal(d.title, 'Daily lookup limit reached');
  assert.match(d.body, /all 20 word lookups for today/);
  assert.match(d.reset, /00:00 Tashkent/);
  const q = shared.limitNoticeFromError({ code: 'DAILY_LIMIT_REACHED', body: { kind: 'quiz', limit: 10 } }, 'ru');
  assert.match(q.body, /все тесты на сегодня: 10/);
  const m = shared.limitNoticeFromError({ code: 'IMPORT_LIMIT_REACHED', body: { limit: 'monthly_pages', monthlyFreePageLimit: 50, resetAt: '2026-11-30T19:00:00.000Z' } }, 'en');
  assert.match(m.body, /all 50 free pages for this month/);
  assert.match(m.reset, /1 December 2026 at 00:00 Tashkent/);
  const di = shared.limitNoticeFromError({ code: 'IMPORT_LIMIT_REACHED', body: { limit: 'daily_imports', dailyFreeImportsPerUser: 3 } }, 'uz');
  assert.match(di.body, /3 ta bepul import/);
  assert.ok(shared.limitNoticeFromError({ code: 'PAYMENTS_DISABLED' }, 'en'));
  assert.equal(shared.limitNoticeFromError({ code: 'OTHER' }, 'en'), null);
});

test('learner src: no 05:00 resets, no UTC-midnight reset helpers', () => {
  for (const f of [...walk(SRC), ...walk(SHARED)]) {
    const s = readFileSync(f, 'utf8');
    assert.doesNotMatch(s, /05:00/, f);
  }
});

test('payments flag defaults off and gates the upsells', () => {
  const lim = readFileSync(join(SRC, 'lib', 'limits.ts'), 'utf8');
  assert.match(lim, /VITE_PAYMENTS_ENABLED === 'true'/);
  const shell = readFileSync(join(SRC, 'pages', 'LearnerShell.tsx'), 'utf8');
  assert.match(shell, /!paymentsEnabled\(\) \? null : expanded/);
  assert.match(shell, /<LimitDialog/);
  const settings = readFileSync(join(SRC, 'pages', 'SettingsPage.tsx'), 'utf8');
  assert.match(settings, /\{payments && \(\s*<button[\s\S]*?importMoreContent/);
  const imp = readFileSync(join(SRC, 'pages', 'ImportPage.tsx'), 'utf8');
  assert.match(imp, /gatewayEnabled && paymentsEnabled\(\)\s*\? copy\.importPage\.paidImportsHint/);
  assert.equal((imp.match(/if \(blockedByFreeLimit\(quote\)\) return;/g) || []).length, 3);
  const auth = readFileSync(join(SRC, 'pages', 'AuthPage.tsx'), 'utf8');
  assert.match(auth, /\{!adminReturnUrl && \([\s\S]*?signUpFree/);
});

test('r3b: limit bodies never say Free/Free tarif (Plus users see them too), all langs', () => {
  for (const lang of ['en', 'ru', 'uz']) {
    const bodies = [
      shared.limitNoticeFromError({ code: 'DAILY_LIMIT_REACHED', body: { kind: 'lookup', limit: 20 } }, lang).body,
      shared.limitNoticeFromError({ code: 'DAILY_LIMIT_REACHED', body: { kind: 'quiz', limit: 200 } }, lang).body,
      shared.limitNoticeFromError({ code: 'IMPORT_LIMIT_REACHED', body: { limit: 'daily_imports', dailyFreeImportsPerUser: 3 } }, lang).body,
      shared.limitNoticeFromError({ code: 'IMPORT_LIMIT_REACHED', body: { limit: 'monthly_pages', monthlyFreePageLimit: 50 } }, lang).body,
    ];
    for (const b of bodies) { assert.ok(!/\bFree\b|Free tarif|includes|входит/.test(b), `${lang}: ${b}`); assert.ok(!/\bmust\b/i.test(b)); }
  }
});
