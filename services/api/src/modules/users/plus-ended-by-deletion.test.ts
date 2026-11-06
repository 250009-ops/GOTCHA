import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { userCapPlan } from '../../common/plan-caps';
import { plusEndedByDeletion } from './users.service';

test('account deletion ends active Plus at the wipe time and keeps the row', () => {
  const endedAt = new Date('2026-11-06T07:10:00.000Z');
  const change = plusEndedByDeletion('user-1', endedAt);
  assert.deepEqual(change.where, { userId: 'user-1', kind: 'plus', status: 'active' });
  assert.equal(change.data.status, 'revoked');
  assert.equal(change.data.revokedReason, 'account_deleted');
  assert.equal(change.data.expiresAt, endedAt);
  assert.equal(Object.prototype.hasOwnProperty.call(change, 'delete'), false);
});

test('a deleted user with a premium subscription is not counted as Plus', async () => {
  const plan = await userCapPlan({
    user: { findUnique: async () => ({ deletedAt: new Date('2026-11-06T07:10:00.000Z') }) },
    userSubscription: { findFirst: async () => ({ plan: { tier: 'premium' } }) },
  }, 'deleted-user');
  assert.equal(plan, 'free');
});
