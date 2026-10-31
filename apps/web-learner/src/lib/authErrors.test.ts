import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSessionRejected, refreshRejected } from './authErrors.ts';

test('only 401 signs the user out', () => {
  assert.equal(isSessionRejected({ status: 401 }), true);
  for (const s of [500, 502, 503, 504, 429, 403, 404, 400]) assert.equal(isSessionRejected({ status: s }), false, String(s));
  assert.equal(isSessionRejected(new TypeError('Failed to fetch')), false);
  assert.equal(isSessionRejected(undefined), false);
});

test('refresh tokens are cleared only on 401', () => {
  assert.equal(refreshRejected(401), true);
  for (const s of [500, 502, 503, 504, 429, 400]) assert.equal(refreshRejected(s), false, String(s));
});
