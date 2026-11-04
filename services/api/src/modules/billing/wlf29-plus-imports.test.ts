// Plus plan cards use the Free import pool. A stored plus* pool is not published.
import * as assert from 'node:assert/strict';
import { enrichPlan, plusImportLimits } from './billing.service';
const fake = (value: unknown) => ({ platformSetting: { findUnique: async () => (value === undefined ? null : { value }) } });
(async () => {
  const live = { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50, plusDailyImportsPerUser: 20, plusMonthlyPageLimit: 2000 };
  const pl = await plusImportLimits(fake(live));
  assert.deepEqual(pl, { imports: 3, pages: 50, cycle: 'monthly' });
  const plan: any = { id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 34990, importLimit: 3, aiDailyQuota: 1, quizDailyQuota: 1, features: [] };
  const e: any = enrichPlan(plan, 'en', undefined, 20, 10, null, 3, 200, { pages: 50, cycle: 'monthly' }, { imports: 20, pages: 2000, cycle: 'monthly' });
  assert.equal(e.importLimit, 3);
  assert.equal(e.monthlyFreePageLimit, 50);
  assert.ok(e.features.includes('50% off every paid import'), JSON.stringify(e.features));
  assert.ok(!e.features.some((f: string) => /20 free imports|2[,\s.]?000/.test(f)), JSON.stringify(e.features));
  assert.deepEqual(await plusImportLimits(fake({ ...live, plusDailyImportsPerUser: 7, plusMonthlyPageLimit: 900 })), { imports: 3, pages: 50, cycle: 'monthly' });
  assert.deepEqual(await plusImportLimits(fake({ dailyFreeImportsPerUser: 4, monthlyFreePageLimit: 60 })), { imports: 4, pages: 60, cycle: 'monthly' });
  const free: any = enrichPlan({ ...plan, tier: 'free' }, 'en', undefined, 20, 10, null, 3, 200, { pages: 50, cycle: 'monthly' }, pl);
  assert.equal(free.importLimit, 3);
  console.log('wlf29-plus-imports: ok');
})().catch((e) => { console.error(e); process.exit(1); });
