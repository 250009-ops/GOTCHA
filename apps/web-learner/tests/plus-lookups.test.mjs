import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// 31 Oct 14:40: Plus has no daily lookup cap; copy names no Plus lookup number and no limit claim
// payments-02 (this branch) ships guard G1: "No daily limit on word lookups" is now the approved Plus line
// (payments-02 wins on copy), so it is no longer banned; unlimited / fair use / 200 lookups still are.
// Test files and comments are not UI copy and are skipped.
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const files = [...walk('src'), ...walk('../../packages/shared/src')].filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\.ts$/.test(f));
const BANNED = /\b(unlimited|fair use|200 word lookups|200 lookups)\b|cheksiz|безлимит|∞/i;
const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const STRING = /(['"`])((?:\\.|(?!\1).)*)\1/g;
test('no copy says unlimited / fair use / 200 (word) lookups', () => {
  const hits = [];
  for (const f of files) {
    const src = stripComments(readFileSync(f, 'utf8'));
    for (const m of src.matchAll(STRING)) if (BANNED.test(m[2])) hits.push(`${f}: ${m[2].slice(0, 80)}`);
  }
  assert.deepEqual(hits, []);
});
test('Plus lookups are uncapped: null quota shows the count only, no denominator', () => {
  const settings = readFileSync('src/pages/SettingsPage.tsx', 'utf8');
  assert.doesNotMatch(settings, /\?\? 50;/);
  assert.match(settings, /quota === null \? lookupsToday/);
  assert.match(settings, /aiLookupsLine\(lookupsToday, quota === null \? null/);
  const copy = readFileSync('../../packages/shared/src/learnerCopy.ts', 'utf8');
  assert.equal((copy.match(/aiLookupsLine: \(used, quota\) => \(quota === null \?/g) || []).length, 3);
});
