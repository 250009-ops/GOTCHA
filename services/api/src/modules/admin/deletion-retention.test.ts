/** final-5 A10/B12 + B5: deletion requests listed with a 1-year purge date; hard delete needs a typed confirm, is refused
 *  inside the retention window, allowed after it (audit-logged); daily caps reset at midnight Asia/Tashkent. */
import assert from 'node:assert/strict';
import { AdminService, deletionPurgeAfter, isSelfDeleted } from './admin.service';
import { dailyLimitBody, nextLimitResetAt } from '../../common/plan-limits';

const day = 86_400_000;
const now = new Date('2026-10-31T11:00:00Z');
const recent = { id: 'u1', email: 'deleted-u1@deleted.gotcha.app', deletedAt: new Date(now.getTime() - 10 * day), createdAt: now, adminProfile: null };
const old = { id: 'u2', email: 'deleted-u2@deleted.gotcha.app', deletedAt: new Date(now.getTime() - 400 * day), createdAt: now, adminProfile: null };
const active = { id: 'u3', email: 'a@b.c', deletedAt: null, createdAt: now, adminProfile: null };
const suspended = { id: 'u4', email: 's@b.c', deletedAt: now, createdAt: now, adminProfile: null };
assert.equal(isSelfDeleted(recent), true); assert.equal(isSelfDeleted(suspended), false);
assert.equal(deletionPurgeAfter(recent)!.toISOString().slice(0, 10), '2027-10-21');
assert.equal(deletionPurgeAfter(active), null);

const users: Record<string, any> = { u1: recent, u2: old, u3: active, u4: suspended };
const deleted: string[] = []; const audit: any[] = [];
const prisma = {
  user: {
    findUnique: async ({ where }: any) => users[where.id] ?? null,
    findMany: async ({ where }: any) => Object.values(users).filter((u: any) => u.email.startsWith(where.email.startsWith) && u.deletedAt),
    delete: async ({ where }: any) => { deleted.push(where.id); },
  },
  auditLog: { create: async (a: any) => { audit.push(a.data); } },
};
const svc = Object.create(AdminService.prototype) as AdminService;
(svc as any).prisma = prisma;
(async () => {
  const list = await svc.listDeletionRequests();
  assert.deepEqual(list.map((r) => [r.id, r.purgeDue]).sort(), [['u1', false], ['u2', true]]);
  await assert.rejects(() => svc.hardDeleteUser('u3', { now }), /confirm/);
  await assert.rejects(() => svc.hardDeleteUser('u1', { confirm: 'u1', now }), /retention window.*2027-10-21/);
  assert.deepEqual(await svc.hardDeleteUser('u2', { confirm: 'u2', actorId: null, now }), { deleted: true, id: 'u2' });
  assert.deepEqual(await svc.hardDeleteUser('u3', { confirm: 'u3', actorId: null, now }), { deleted: true, id: 'u3' });
  assert.deepEqual(deleted, ['u2', 'u3']);
  assert.equal(audit.length, 2); assert.equal(audit[0].action, 'user.hard_delete');

  // B5 reset: 23:30 Tashkent (18:30Z) → next midnight Tashkent = 19:00Z same day; 00:10 Tashkent (19:10Z) → 19:00Z next day
  assert.equal(nextLimitResetAt(new Date('2026-10-31T18:30:00Z')).toISOString(), '2026-10-31T19:00:00.000Z');
  assert.equal(nextLimitResetAt(new Date('2026-10-31T19:10:00Z')).toISOString(), '2026-11-01T19:00:00.000Z');
  const b = dailyLimitBody('quiz', 10, new Date('2026-10-31T11:00:00Z'));
  assert.deepEqual([b.code, b.kind, b.limit, b.resetAt, b.timezone], ['DAILY_LIMIT_REACHED', 'quiz', 10, '2026-10-31T19:00:00.000Z', 'Asia/Tashkent']);
  console.log('deletion-retention.test: OK (requests listed, confirm + 1-year retention enforced, audit-logged; Tashkent reset)');
})().catch((e) => { console.error(e); process.exit(1); });
