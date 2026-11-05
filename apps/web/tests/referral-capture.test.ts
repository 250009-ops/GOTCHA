import assert from 'node:assert/strict';
import { test } from 'node:test';
import { referralCapture } from '../src/lib/referralCapture.ts';

test('referral link sets a 30-day cookie and redirects to register', () => {
  const captured = referralCapture('dilnoza', '/register');
  assert.ok(captured);
  assert.equal(captured.code, 'DILNOZA');
  assert.match(captured.cookie, /^gotcha_ref=DILNOZA;/);
  assert.match(captured.cookie, /Max-Age=2592000/);
  assert.match(captured.cookie, /Path=\//);
  assert.match(captured.cookie, /SameSite=Lax/);
  assert.equal(captured.location, '/register?ref=DILNOZA');
});

test('a short or empty code is not captured', () => {
  assert.equal(referralCapture('ab', '/register'), null);
  assert.equal(referralCapture('', '/register'), null);
});
