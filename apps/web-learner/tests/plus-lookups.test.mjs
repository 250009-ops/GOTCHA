import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// 31 Oct 14:40: Plus has no daily lookup cap; copy names no Plus lookup number and no limit claim
// (the "No daily limit on word lookups" line ships only with payments-02, guard G1).
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk('src'), ...walk('../../packages/shared/src')].filter((f) => /\.(ts|tsx)$/.test(f));
const BANNED = /\b(unlimited|fair use|200 word lookups|200 lookups|no daily limit)\b|cheksiz|безлимит|∞/i;
const STRING = /(['"`])((?:\\.|(?!\1).)*)\1/g;
test('no copy says unlimited / fair use / 200 (word) lookups / no daily limit', () => {
  const hits = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(STRING)) if (BANNED.test(m[2])) hits.push(`${f}: ${m[2].slice(0, 80)}`);
  }
  assert.deepEqual(hits, []);
});
test('Plus lookups are uncapped: null quota shows the count only, no denominator', () => {
  const settings = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
  assert.doesNotMatch(settings, /\?\? 50;/);
  assert.match(settings, /quota === null \? lookupsToday/);
  // final-5: capped -> "left N of M"; null quota -> count only.
  assert.match(settings, /: copy\.settings\.aiLookupsLine\(lookupsToday, null\)/);
  const copy = readFileSync('../../packages/shared/src/learnerCopy.ts', 'utf8');
  assert.equal((copy.match(/aiLookupsLine: \(used, quota\) => \(quota === null \?/g) || []).length, 3);
});
