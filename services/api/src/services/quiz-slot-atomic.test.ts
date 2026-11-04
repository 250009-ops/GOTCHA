// PAY2-04: quiz cap check + increment is one conditional write; N parallel starts never exceed the cap.
import * as assert from 'node:assert/strict';
import { LimitsService } from './limits.service';
import { resetPlanCapsCache } from '../common/plan-caps';

const tick = () => new Promise((r) => setImmediate(r));
function db(tier: 'free' | 'premium', start = 0) {
  const row: { quizCount: number } | null = start ? { quizCount: start } : null;
  const state = { row };
  return {
    state,
    subscriptionPlan: { findMany: async () => [{ tier: 'free', aiDailyQuota: 20, quizDailyQuota: 10 }, { tier: 'premium', aiDailyQuota: 1_000_000, quizDailyQuota: 200 }] },
    platformSetting: { findMany: async () => [] },
    userSubscription: { findFirst: async () => (tier === 'premium' ? { plan: { tier: 'premium' } } : null) },
    aiUsageDaily: {
      // every await yields so requests interleave as they would against Postgres
      createMany: async ({ data }: any) => { await tick(); if (!state.row) state.row = { quizCount: data[0].quizCount }; return { count: 1 }; },
      update: async ({ data }: any) => { await tick(); state.row!.quizCount += data.quizCount.increment; return state.row; },
      findUnique: async () => { await tick(); return state.row; },
      // single-statement conditional UPDATE: evaluated + applied without yielding (row lock)
      updateMany: async ({ where, data }: any) => {
        await tick();
        const r = state.row!; const c = where.quizCount;
        if ((c.lt != null && !(r.quizCount < c.lt)) || (c.gt != null && !(r.quizCount > c.gt))) return { count: 0 };
        r.quizCount += data.quizCount.increment ?? -data.quizCount.decrement; return { count: 1 };
      },
    },
  } as any;
}

async function main() {
  for (const [tier, cap] of [['free', 10], ['premium', 200]] as const) {
    resetPlanCapsCache();
    const d = db(tier);
    const svc = new LimitsService(d);
    const N = cap + 25;
    const res = await Promise.allSettled(Array.from({ length: N }, () => svc.reserveQuizSlot('u')));
    const ok = res.filter((r) => r.status === 'fulfilled').length;
    const rejected = res.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    assert.equal(ok, cap, `${tier}: exactly cap slots granted`);
    assert.equal(d.state.row.quizCount, cap, `${tier}: counter == cap, never over`);
    for (const r of rejected) { assert.equal(r.reason.getStatus(), 429); assert.equal(r.reason.getResponse().code, 'quiz_limit'); }
    await svc.releaseQuizSlot('u');
    assert.equal(d.state.row.quizCount, cap - 1, 'release gives a slot back');
    await svc.reserveQuizSlot('u');
    await assert.rejects(svc.reserveQuizSlot('u'));
  }
  // release never goes below 0
  resetPlanCapsCache();
  const d = db('free', 0); const svc = new LimitsService(d);
  await svc.reserveQuizSlot('u'); await svc.releaseQuizSlot('u'); await svc.releaseQuizSlot('u');
  assert.equal(d.state.row.quizCount, 0);
  console.log('quiz-slot-atomic: all passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
