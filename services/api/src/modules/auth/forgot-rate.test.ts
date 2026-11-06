import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FORGOT_LIMIT, FORGOT_WINDOW_MS, takeForgotSlot } from './forgot-rate.ts';

test('allows 5 forgot-password hits per key in 15 minutes, then refuses', () => {
  const store = new Map<string, number[]>();
  const now = 1_000_000;
  for (let i = 0; i < FORGOT_LIMIT; i += 1) assert.equal(takeForgotSlot(store, 'ip:1', now + i), true);
  assert.equal(takeForgotSlot(store, 'ip:1', now + FORGOT_LIMIT), false);
  assert.equal(takeForgotSlot(store, 'id:+998901112233', now), true);
});

test('the window slides: a hit older than 15 minutes no longer counts', () => {
  const store = new Map<string, number[]>();
  const now = 5_000_000;
  for (let i = 0; i < FORGOT_LIMIT; i += 1) assert.equal(takeForgotSlot(store, 'id:a@b.c', now), true);
  assert.equal(takeForgotSlot(store, 'id:a@b.c', now + FORGOT_WINDOW_MS), true);
});
