// DB-driven pricing: promo math, validation, redemption-once, plan edits, seed matches PRICING.md (non-PROPOSAL).
import * as assert from 'node:assert/strict';
import { PricingService, promoDiscountTiyins } from './pricing.service';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const seed = require('../../../prisma/pricing-seed.json');

async function main() {
  // 70% cap and Atmos minimum (500 UZS = 50_000 tiyins)
  assert.equal(promoDiscountTiyins(1_200_000, { percentOff: 20, amountOffUzs: null }, 50_000), 240_000);
  assert.equal(promoDiscountTiyins(1_200_000, { percentOff: null, amountOffUzs: 100_000 }, 50_000), 840_000, 'fixed capped at 70%');
  assert.equal(promoDiscountTiyins(60_000, { percentOff: 70, amountOffUzs: null }, 50_000), 10_000, 'never below the minimum charge');
  assert.equal(promoDiscountTiyins(0, { percentOff: 50, amountOffUzs: null }, 50_000), 0);

  const now = new Date('2026-11-01T00:00:00Z');
  const promos: any[] = [
    { id: 'p1', code: 'LAUNCH', active: true, appliesTo: 'all', percentOff: 20, amountOffUzs: null, validFrom: null, validTo: new Date('2026-12-01'), maxRedemptions: 2, redemptions: 0, perUserLimit: 1 },
    { id: 'p2', code: 'BOOKS', active: true, appliesTo: 'catalog', percentOff: 10, amountOffUzs: null, validFrom: null, validTo: null, maxRedemptions: null, redemptions: 0, perUserLimit: 1 },
    { id: 'p3', code: 'OLD', active: true, appliesTo: 'all', percentOff: 10, amountOffUzs: null, validFrom: null, validTo: new Date('2026-10-01'), maxRedemptions: null, redemptions: 0, perUserLimit: 1 },
  ];
  const payments: any[] = [{ id: 'pay1', userId: 'u1', promoCodeId: 'p1', promoRedeemed: false }];
  const plans: any[] = [{ id: 'f', tier: 'free', name: 'Free', priceMonthly: 0, active: true }, { id: 'pr', tier: 'premium', name: 'Plus', priceMonthly: 34990, active: true, nameI18n: { en: 'Plus' } }];
  const prisma: any = {
    promoCode: {
      findUnique: async ({ where }: any) => promos.find((p) => p.code === where.code) ?? null,
      update: async ({ where, data }: any) => { const p = promos.find((x) => x.id === where.id); p.redemptions += data.redemptions.increment; return p; },
    },
    importPayment: {
      count: async ({ where }: any) => payments.filter((p) => p.userId === where.userId && p.promoCodeId === where.promoCodeId && p.promoRedeemed).length,
      findUnique: async ({ where }: any) => payments.find((p) => p.id === where.id),
      updateMany: async ({ where, data }: any) => { const p = payments.find((x) => x.id === where.id && x.promoRedeemed === where.promoRedeemed); if (!p) return { count: 0 }; Object.assign(p, data); return { count: 1 }; },
    },
    subscriptionPlan: {
      findFirst: async ({ where }: any) => plans.find((p) => p.tier === where.tier) ?? null,
      update: async ({ where, data }: any) => Object.assign(plans.find((p) => p.id === where.id), data),
    },
  };
  const svc = new PricingService(prisma);
  const code = async (c: string, scope: 'imports' | 'catalog', user = 'u1') =>
    svc.resolvePromo(c, user, scope, now).then(() => 'ok', (e) => e.getResponse().code);
  assert.equal(await code('launch', 'imports'), 'ok', 'case-insensitive');
  assert.equal(await code('BOOKS', 'imports'), 'promo_not_applicable');
  assert.equal(await code('OLD', 'imports'), 'promo_expired');
  assert.equal(await code('NOPE', 'imports'), 'promo_invalid');
  // redemption counted once even when called twice (webhook + poll)
  assert.equal(await svc.redeemForPayment('pay1'), true);
  assert.equal(await svc.redeemForPayment('pay1'), false);
  assert.equal(promos[0].redemptions, 1);
  assert.equal(await code('LAUNCH', 'imports'), 'promo_used', 'per-user limit');
  promos[0].redemptions = 2;
  assert.equal(await code('LAUNCH', 'imports', 'u2'), 'promo_exhausted');

  // plan edits
  await assert.rejects(svc.updatePlan('free', { priceUzs: 1000 }), /free plan must cost 0/);
  await assert.rejects(svc.updatePlan('free', { active: false }), /cannot be deactivated/);
  await assert.rejects(svc.updatePlan('premium', { features: ['Bad Key'] }), /snake_case/);
  const { before, after } = await svc.updatePlan('premium', { priceUzs: 29990, nameI18n: { en: 'Plus', ru: 'Плюс' } });
  assert.equal(after.priceMonthly, 29990);
  assert.deepEqual(after.nameI18n, { en: 'Plus', ru: 'Плюс', uz: 'Plus' });
  assert.ok(before);

  // Seed = PRICING.md §7 non-PROPOSAL rows only
  assert.deepEqual(seed.subscriptionPlans.map((p: any) => [p.tier, p.priceMonthly]), [['free', 0], ['premium', 24990]]); // Kai option 1 (13:54): 24990/30 days; PRICING.md 34990 superseded, pending Sarvarbek's direct confirmation (PAY1-05)
  assert.deepEqual(seed.subscriptionPlans.map((p: any) => [p.tier, p.aiDailyQuota]), [['free', 20], ['premium', 1000000]]); // Free 20; Plus has no daily lookup limit: premium row stays >= 1e6, never 200 (PAYMENTS §14)
  for (const p of seed.subscriptionPlans.filter((x: any) => x.tier === 'premium')) assert.ok(p.aiDailyQuota >= 1_000_000, 'premium aiDailyQuota must stay >= 1e6');
  assert.deepEqual(seed.subscriptionPlans.map((p: any) => [p.tier, p.quizDailyQuota]), [['free', 10], ['premium', 200]]);
  assert.ok(!JSON.stringify(seed).includes('ai_lookup_unlimited'), 'Plus is capped: no unlimited feature');
  assert.deepEqual(seed.importPageTiers.map((t: any) => t.priceUsd), [12000, 29000, 49000, 79000]);
  assert.ok(!JSON.stringify(seed).match(/yearly|student|299990|179990/), 'no PROPOSAL rows');
  console.log('pricing: all passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
