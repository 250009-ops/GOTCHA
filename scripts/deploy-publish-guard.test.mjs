// PAY2-24: every deploy script that builds the marketing site (apps/web) must use build:publish (the legal publish guard).
// Where apps/web has no build:publish, npm fails with "Missing script" and the deploy stops (fail-closed).
// Run: node --test scripts/deploy-publish-guard.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const RE = /(['"]|\s)(run['"]?,?\s*['"]?build)\b(?!:publish)[^\n]*apps\/web(?![-\w])/;
test('PAY2-24: no deploy script builds apps/web without build:publish', () => {
  const files = [...readdirSync(join(root, 'scripts')).map((f) => join(root, 'scripts', f)), ...readdirSync(join(root, 'deploy'), { recursive: true }).map((f) => join(root, 'deploy', String(f)))].filter((f) => /\.(mjs|js|cjs|sh)$/.test(f));
  const bad = files.flatMap((f) => readFileSync(f, 'utf8').split('\n').filter((l) => RE.test(l)).map((l) => `${f}: ${l.trim()}`));
  assert.deepEqual(bad, []);
  assert.ok(files.length > 3);
});
