/** WLF-12: with prod's legacy plan rows (Free import_limit 100 / ai_daily_quota 5000, Premium 1000000/1000000 at 9.00)
 *  the enforced AND displayed Free caps are 3 imports / 20 lookups / 10 quizzes, from config only. */
import * as assert from 'node:assert/strict';
import { getPlanCaps, resetPlanCapsCache } from './plan-caps';
import { BillingService } from '../modules/billing/billing.service';
import { MarketingService } from '../modules/marketing/marketing.service';

const rows = [
  { id: 'f', tier: 'free', name: 'Free', priceMonthly: 0, aiDailyQuota: 5000, importLimit: 100, offlineEnabled: false },
  { id: 'p', tier: 'premium', name: 'Premium', priceMonthly: 9.0, aiDailyQuota: 1000000, importLimit: 1000000, offlineEnabled: true },
];
function prisma(settings: Record<string, unknown> = {}): any {
  return new Proxy({
    subscriptionPlan: { findMany: async () => rows, findUnique: async ({ where }: any) => rows.find((r) => r.tier === where.tier) ?? null, findFirst: async () => rows[0] },
    platformSetting: {
      findUnique: async ({ where }: any) => (where.key in settings ? { key: where.key, value: settings[where.key] } : null),
      findMany: async ({ where }: any = {}) => Object.entries(settings).filter(([k]) => !where?.key?.in || where.key.in.includes(k)).map(([key, value]) => ({ key, value })),
    },
  }, { get: (t: any, k) => (k in t ? t[k] : new Proxy({}, { get: () => async () => [] })) });
}
(async () => {
  resetPlanCapsCache();
  const caps = await getPlanCaps(prisma());
  assert.deepEqual(caps.free, { lookups: 20, quizzes: 10, mashq: 20 }, 'enforced Free caps ignore ai_daily_quota 5000');
  assert.equal(caps.plus.lookups, null, 'Plus: no daily lookup cap');
  assert.equal(caps.plus.mashq, null, 'Plus Mashq is never capped');
  assert.equal(caps.plus.quizzes, 200);
  resetPlanCapsCache();
  const c2 = await getPlanCaps(prisma({ 'caps.free.lookups': 25, 'caps.free.quizzes': 12, 'caps.plus.quizzes': 150 }));
  assert.deepEqual([c2.free.lookups, c2.free.quizzes, c2.plus.quizzes], [25, 12, 150], 'admin config drives caps');

  for (const lang of ['en', 'ru', 'uz'] as const) {
    resetPlanCapsCache();
    const out: any[] = await new (BillingService as any)(prisma(), {}, {}).listPlans(lang);
    const free = out.find((p) => p.tier === 'free');
    const text = JSON.stringify(out);
    assert.equal(free.aiDailyQuota, 20); assert.equal(free.quizDailyQuota, 10); assert.equal(free.importLimit, 3);
    assert.doesNotMatch(text, /\b(5000|5 000|100)\b/, `${lang}: legacy plan values not shown`);
    resetPlanCapsCache();
    const m: any = await new (MarketingService as any)(prisma()).plans(lang);
    {
      const s = JSON.stringify(m);
      assert.doesNotMatch(s, /\b(5000|5 000)\b/, `${lang}: marketing hides 5000`);
      const mf = (m.plans ?? m).find?.((p: any) => p.tier === 'free') ?? m.free;
      assert.ok(mf, 'marketing free plan'); { assert.equal(mf.aiDailyQuota, 20); assert.equal(mf.importLimit, 3); }
    }
  }
  console.log('plan-caps-prod-rows: OK');
})().catch((e) => { console.error(e); process.exit(1); });
