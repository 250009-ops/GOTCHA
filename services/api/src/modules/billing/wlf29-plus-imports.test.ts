// WLF-29: Plus import limits on /billing/plans come from importFreeLimits.plus* (no hardcoded 3).
import * as assert from 'node:assert/strict';
import { enrichPlan, plusImportLimits } from './billing.service';
const fake = (value: unknown) => ({ platformSetting: { findUnique: async () => (value === undefined ? null : { value }) } });
(async () => {
  const live = { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50, plusDailyImportsPerUser: 20, plusMonthlyPageLimit: 2000 };
  const pl = await plusImportLimits(fake(live));
  assert.deepEqual(pl, { imports: 20, pages: 2000, cycle: 'monthly' });
  const plan: any = { id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 34990, importLimit: 3, aiDailyQuota: 1, quizDailyQuota: 1, features: [] };
  const e: any = enrichPlan(plan, 'en', undefined, 20, 10, null, 3, 200, { pages: 50, cycle: 'monthly' }, pl);
  assert.equal(e.importLimit, 20);
  assert.equal(e.monthlyFreePageLimit, 2000);
  assert.ok(e.features.some((f: string) => /20/.test(f)) && e.features.some((f: string) => /2[,\s.]?000/.test(f)), JSON.stringify(e.features));
  // other values follow settings too (no hardcoding)
  assert.deepEqual(await plusImportLimits(fake({ ...live, plusDailyImportsPerUser: 7, plusMonthlyPageLimit: 900 })), { imports: 7, pages: 900, cycle: 'monthly' });
  // unset Plus pool = Free numbers (import-commerce capOf rule)
  assert.deepEqual(await plusImportLimits(fake({ dailyFreeImportsPerUser: 4, monthlyFreePageLimit: 60 })), { imports: 4, pages: 60, cycle: 'monthly' });
  const free: any = enrichPlan({ ...plan, tier: 'free' }, 'en', undefined, 20, 10, null, 3, 200, { pages: 50, cycle: 'monthly' }, pl);
  assert.equal(free.importLimit, 3);
  console.log('wlf29-plus-imports: 7/7 OK');
})().catch((e) => { console.error(e); process.exit(1); });
