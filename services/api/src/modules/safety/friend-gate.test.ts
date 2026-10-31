import * as assert from 'node:assert/strict';
import { assertCanMessage, sendFriendRequest, respondFriendRequest } from './friend-gate';

const Y = new Date().getUTCFullYear();
function fake(users: Record<string, number | null>) {
  const reqs: Array<{ id: string; requesterId: string; addresseeId: string; status: string; createdAt: Date }> = [];
  const match = (r: (typeof reqs)[0], w: any): boolean => {
    if (w.OR) return w.OR.some((o: any) => match(r, { ...w, OR: undefined, ...o }));
    return Object.entries(w).every(([k, v]) => v === undefined || (r as any)[k] === v);
  };
  return {
    reqs,
    user: {
      findMany: async (a: any) => a.where.id.in.filter((id: string) => id in users).map((id: string) => ({ id, birthYear: users[id] })),
      findFirst: async (a: any) => (a.where.id in users ? { id: a.where.id, birthYear: users[a.where.id] } : null),
    },
    friendRequest: {
      findFirst: async (a: any) => reqs.find((r) => match(r, a.where)) ?? null,
      findMany: async () => reqs,
      create: async (a: any) => { const r = { id: `r${reqs.length}`, status: 'pending', createdAt: new Date(), ...a.data }; reqs.push(r); return r; },
      update: async (a: any) => { const r = reqs.find((x) => x.id === a.where.id)!; Object.assign(r, a.data); return r; },
      deleteMany: async () => ({ count: 0 }),
    },
    userBlock: { findFirst: async () => null },
  };
}
(async () => {
  const p = fake({ kid: Y - 10, teen: Y - 15, teen2: Y - 16, adult: Y - 30, adult2: Y - 40, unknown: null });
  await assertCanMessage(p as any, 'adult', 'adult2'); // open
  await assert.rejects(assertCanMessage(p as any, 'kid', 'adult'), /not available/);
  await assert.rejects(assertCanMessage(p as any, 'adult', 'kid'), /not available/);
  await assert.rejects(assertCanMessage(p as any, 'teen', 'adult'), /friends/);
  await assert.rejects(assertCanMessage(p as any, 'unknown', 'adult'), /friends/); // unknown = teen limits
  await assert.rejects(sendFriendRequest(p as any, 'kid', 'teen'), /not available/);
  const r = await sendFriendRequest(p as any, 'teen', 'teen2');
  await assert.rejects(assertCanMessage(p as any, 'teen', 'teen2'), /friends/); // pending isn't enough
  await respondFriendRequest(p as any, 'teen2', r.id, true);
  await assertCanMessage(p as any, 'teen', 'teen2');
  await assertCanMessage(p as any, 'teen2', 'teen');
  // Mutual request auto-accepts.
  // WL4-12: an adult can't initiate to a no-age user, but the no-age user can, and the adult's reply auto-accepts.
  await assert.rejects(sendFriendRequest(p as any, 'adult', 'unknown'), /not found/);
  await sendFriendRequest(p as any, 'unknown', 'adult');
  await sendFriendRequest(p as any, 'adult', 'unknown');
  await assertCanMessage(p as any, 'unknown', 'adult');
  console.log('friend-gate: OK');
})().catch((e) => { console.error(e); process.exit(1); });
