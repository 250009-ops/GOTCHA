/** PAY2-18: /billing/plans Free card states the enforced import allowance from config, never the seed's "15 free imports a day". */
import * as assert from 'node:assert/strict';
import { BillingService } from './billing.service';

const plans = [
  { id: 'f', tier: 'free', name: 'Free', priceMonthly: 0, aiDailyQuota: 20, quizDailyQuota: 10, importLimit: 15 },
  { id: 'p', tier: 'premium', name: 'Plus', priceMonthly: 24990, aiDailyQuota: 1000000, quizDailyQuota: 200, importLimit: 15 },
];
function svc(settings: Record<string, unknown>) {
  const prisma: any = {
    subscriptionPlan: { findMany: async () => plans },
    platformSetting: { findUnique: async ({ where }: any) => (where.key in settings ? { value: settings[where.key] } : null), findMany: async () => [] },
  };
  return new (BillingService as any)(prisma, {}, {}) as BillingService;
}
(async () => {
  for (const lang of ['en', 'ru', 'uz'] as const) {
    const out: any[] = await svc({}).listPlans(lang);
    const free = out.find((p) => p.tier === 'free');
    const text = JSON.stringify(out);
    assert.doesNotMatch(text, /\b15\b/, `${lang}: no 15 imports`);
    assert.equal(free.importLimit, 3, `${lang}: default 3/day`);
    assert.match(free.features.join('|'), /3/, `${lang}: Free card says 3`);
    assert.doesNotMatch(text, /unlimited|fair use|безлимит|cheksiz/i);
  }
  const out: any[] = await svc({ importFreeLimits: { dailyFreeImportsPerUser: 5, monthlyFreePageLimit: 50 } }).listPlans('en');
  const free = out.find((p) => p.tier === 'free');
  assert.equal(free.importLimit, 5);
  assert.ok(free.features.includes('5 free imports a day'), free.features.join('|'));
  console.log('billing-plans-imports: OK');
})().catch((e) => { console.error(e); process.exit(1); });
