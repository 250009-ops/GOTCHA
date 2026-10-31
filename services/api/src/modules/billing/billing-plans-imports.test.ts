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

// WLF-12: /billing/plans and /marketing/plans agree on Free daily imports (same importFreeLimits); seed row is 3, not 15.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MarketingService } from '../marketing/marketing.service';
(async () => {
  const seed = JSON.parse(readFileSync(join(__dirname, '../../../prisma/pricing-seed.json'), 'utf8'));
  assert.equal(seed.subscriptionPlans.find((p: any) => p.tier === 'free').importLimit, 3, 'seed Free importLimit = 3 (FEATURES.md)');
  assert.equal(seed.platformSettings.importFreeLimits.dailyFreeImportsPerUser, 3);
  assert.equal(seed.platformSettings.importFreeLimits.monthlyFreePageLimit, 50, 'seed 50 pages a month (Sarvarbek via Kai 10-31)');
  for (const settings of [{}, { importFreeLimits: { dailyFreeImportsPerUser: 7, monthlyFreePageLimit: 40 } }] as Record<string, unknown>[]) {
    const prisma: any = {
      subscriptionPlan: { findMany: async () => plans, findUnique: async ({ where }: any) => plans.find((p) => p.tier === where.tier) ?? null },
      platformSetting: { findUnique: async ({ where }: any) => (where.key in settings ? { value: settings[where.key] } : null), findMany: async () => [] },
    };
    for (const lang of ['en', 'ru', 'uz'] as const) {
      const b: any[] = await new (BillingService as any)(prisma, {}, {}).listPlans(lang);
      const m: any = await new (MarketingService as any)(prisma).plans(lang);
      const mFree = (m.plans ?? m).find?.((p: any) => p.tier === 'free') ?? m.free;
      const bFree = b.find((p) => p.tier === 'free');
      assert.equal(bFree.importLimit, mFree.importLimit, `${lang}: importLimit agrees`);
      const line = (f: string[]) => f.find((x) => /import|импорт/i.test(x) && /\d/.test(x) && !/page|стр|sahifa/i.test(x));
      assert.ok(line(bFree.features), `${lang}: billing imports line`); assert.equal(line(bFree.features), line(mFree.features), `${lang}: same imports-a-day line`);
      const pages = (f: string[]) => f.find((x) => /page|стр|sahifa/i.test(x));
      assert.ok(pages(bFree.features), `${lang}: billing pages-a-month line`); assert.equal(pages(bFree.features), pages(mFree.features), `${lang}: same pages line`);
      if (!('importFreeLimits' in settings)) {
        const want = { en: ['3 free imports a day', 'Up to 50 free pages of imports a month'], ru: ['3 бесплатных импорта в день', 'До 50 бесплатных страниц импорта в месяц'], uz: ['Kuniga 3 ta bepul import', 'Oyiga 50 sahifagacha bepul import'] }[lang];
        for (const w of want) { assert.ok(bFree.features.includes(w), `${lang} billing: ${w}`); assert.ok(mFree.features.includes(w), `${lang} marketing: ${w}`); }
      }
    }
  }
  console.log('billing-plans-imports: WLF-12 agreement OK');
})().catch((e) => { console.error(e); process.exit(1); });
