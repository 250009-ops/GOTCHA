import * as assert from 'node:assert/strict';
import { assertPeerVisible, sendFriendRequest, respondFriendRequest } from './friend-gate';

const Y = new Date().getUTCFullYear();
const users: Record<string, number | null> = { teen: Y - 15, unknown: null, adult: Y - 30, adult2: Y - 40, teen2: Y - 14 };
const reqs: any[] = [];
const match = (r: any, w: any): boolean => (w.OR ? w.OR.some((o: any) => match(r, { ...w, OR: undefined, ...o })) : Object.entries(w).every(([k, v]) => v === undefined || r[k] === v));
const p: any = {
  user: {
    findMany: async (a: any) => a.where.id.in.filter((id: string) => id in users).map((id: string) => ({ id, birthYear: users[id] })),
    findFirst: async (a: any) => (a.where.id in users ? { id: a.where.id, birthYear: users[a.where.id] } : null),
  },
  friendRequest: {
    findFirst: async (a: any) => reqs.find((r) => match(r, a.where)) ?? null,
    findMany: async () => reqs,
    create: async (a: any) => { const r = { id: `r${reqs.length}`, status: 'pending', createdAt: new Date(), ...a.data }; reqs.push(r); return r; },
    update: async (a: any) => { const r = reqs.find((x) => x.id === a.where.id); Object.assign(r, a.data); return r; },
    deleteMany: async () => ({ count: 0 }),
  },
  userBlock: { findFirst: async () => null },
};
const is404 = (e: any) => e.getStatus?.() === 404;
(async () => {
  // Adults who are not friends: teen / no-age profile by direct id → 404; friend request → 404.
  await assert.rejects(assertPeerVisible(p, 'adult', 'teen'), is404);
  await assert.rejects(assertPeerVisible(p, 'adult', 'unknown'), is404);
  await assert.rejects(sendFriendRequest(p, 'adult', 'teen'), is404);
  await assert.rejects(sendFriendRequest(p, 'adult', 'unknown'), is404);
  assert.equal(reqs.length, 0);
  // Adult↔adult and teen↔teen unaffected; a teen may still see an adult.
  await assertPeerVisible(p, 'adult', 'adult2');
  await assertPeerVisible(p, 'teen', 'teen2');
  await assertPeerVisible(p, 'teen', 'adult');
  // Teen asks the adult → adult may accept → existing friends keep access.
  const r = await sendFriendRequest(p, 'teen', 'adult');
  await assert.rejects(assertPeerVisible(p, 'adult', 'teen'), is404); // pending isn't friendship
  await respondFriendRequest(p, 'adult', r.id, true);
  await assertPeerVisible(p, 'adult', 'teen');
  await sendFriendRequest(p, 'adult', 'teen'); // idempotent for existing friends, no 404
  console.log('wl4-12 hidden peers: OK');
})().catch((e) => { console.error(e); process.exit(1); });
