/** Round-3 (b): pins the EXACT quiz-cap fallback behaviour (kept as is per steering; product decides on 10b).
 *  - caps.*.quizzes missing / JSON null / "" / non-numeric / negative  → code default (Free 10, Plus 200)
 *  - caps.*.quizzes = 0 → cap 0, which reserveQuizSlot / assertUnderCap treat as "no cap": quizzes are NOT limited
 *  - the Plus offer (import-commerce) therefore always carries numeric quiz caps, so paywall variant 10b
 *    (no quiz bullet) cannot be produced from config. */
import * as assert from 'node:assert/strict';
import { assertUnderCap, getPlanCaps, resetPlanCapsCache } from './plan-caps';
import { LimitsService } from '../services/limits.service';

const db = (settings: Record<string, unknown>) => ({
  platformSetting: { findMany: async () => Object.entries(settings).map(([key, value]) => ({ key, value })) },
});
(async () => {
  for (const v of [undefined, null, '', 'abc', -5]) {
    resetPlanCapsCache();
    const s = v === undefined ? {} : { 'caps.free.quizzes': v, 'caps.plus.quizzes': v };
    const c = await getPlanCaps(db(s));
    assert.equal(c.free.quizzes, 10, `free fallback for ${JSON.stringify(v)}`);
    assert.equal(c.plus.quizzes, 200, `plus fallback for ${JSON.stringify(v)}`);
  }
  resetPlanCapsCache();
  const zero = await getPlanCaps(db({ 'caps.free.quizzes': 0, 'caps.plus.quizzes': 0 }));
  assert.equal(zero.free.quizzes, 0); assert.equal(zero.plus.quizzes, 0);
  assert.doesNotThrow(() => assertUnderCap('quizzes', 'free', zero, 1_000), '0 = not enforced');
  // reserveQuizSlot with cap 0 increments with no limit check
  let incs = 0, guarded = 0;
  const prisma: any = {
    ...db({ 'caps.free.quizzes': 0 }),
    userSubscription: { findFirst: async () => null },
    aiUsageDaily: { createMany: async () => ({}), update: async () => { incs++; return {}; }, updateMany: async () => { guarded++; return { count: 0 }; } },
  };
  resetPlanCapsCache();
  const ls = new (LimitsService as any)(prisma);
  for (let i = 0; i < 50; i++) await ls.reserveQuizSlot('u');
  assert.equal(incs, 50); assert.equal(guarded, 0, 'cap 0: no guarded update, never 429');
  console.log('plan-caps-fallback-10b: OK (missing/null/invalid → 10/200; 0 → unlimited quizzes; 10b not reachable from config)');
})().catch((e) => { console.error(e); process.exit(1); });
