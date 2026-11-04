import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shouldLogoutOnBootstrapError, refreshRejected, bootstrapRetryCopy } from '../src/lib/bootstrapPolicy.ts';
test('WL4-02: only 401 logs out at bootstrap', () => {
  assert.equal(shouldLogoutOnBootstrapError({ status: 401 }), true);
  for (const s of [500, 502, 503, 504, 429, 0, undefined]) assert.equal(shouldLogoutOnBootstrapError({ status: s }), false);
  assert.equal(shouldLogoutOnBootstrapError(new TypeError('Failed to fetch')), false);
  assert.equal(refreshRejected(401), true);
  assert.equal(refreshRejected(502), false);
  for (const l of ['uz', 'ru', 'en']) assert.ok(bootstrapRetryCopy(l).retry);
});
test('WL4-02: auth.tsx and api.ts use the policy (no unconditional clearTokens in catch)', () => {
  const auth = readFileSync(new URL('../src/lib/auth.tsx', import.meta.url), 'utf8');
  assert.match(auth, /shouldLogoutOnBootstrapError\(e\)/);
  const api = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');
  assert.match(api, /if \(refreshRejected\(res\.status\)\) clearTokens\(\)/);
  assert.doesNotMatch(api, /catch \{\s*clearTokens\(\);/);
});
