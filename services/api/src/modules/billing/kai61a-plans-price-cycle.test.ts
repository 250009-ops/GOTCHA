// Kai 6.1a: Plus on /billing/plans shows the charged pass prices (24990/199990 by default, not hidden, even when the
// row still holds USD "9"); WLF-37: a stale importFreeLimits.resetCycle='daily' reads as a monthly page pool.
import assert from 'node:assert/strict';
import { buildPlanCards, freeImportPages, plusPassPrices } from './billing.service';
const row = (tier: string, price: number) => ({ id: tier, tier, name: tier, priceMonthly: price, aiDailyQuota: 20, importLimit: 3, quizDailyQuota: 10, offlineEnabled: false, createdAt: new Date(), updatedAt: new Date() });
const mk = (settings: Record<string, unknown>) => ({
  subscriptionPlan: { findMany: async () => [row('free', 0), row('premium', 9)] },
  platformSetting: { findUnique: async ({ where: { key } }: { where: { key: string } }) => (key in settings ? { value: settings[key] } : null), findMany: async () => [] },
}) as never;
(async () => {
  delete process.env.PLUS_PASS_30_PRICE_UZS; delete process.env.PLUS_PASS_365_PRICE_UZS;
  assert.deepEqual(await plusPassPrices(mk({})), { p30: 24990, p365: 199990 });
  assert.deepEqual(await plusPassPrices(mk({ 'plus.pass.price_30_uzs': 30000 })), { p30: 30000, p365: 199990 });
  const daily = { importFreeLimits: { monthlyFreePageLimit: 50, resetCycle: 'daily', dailyFreeImportsPerUser: 3 } };
  assert.equal((await freeImportPages(mk(daily))).cycle, 'monthly');
  assert.equal((await freeImportPages(mk({ importFreeLimits: { resetCycle: 'monthly' } }))).cycle, 'monthly');
  const cards = await buildPlanCards(mk(daily), 'en');
  const plus = cards.find((c) => c.tier === 'premium')! as Record<string, unknown>;
  assert.equal(plus.priceMonthly, 24990); assert.equal(plus.priceHidden, false); assert.equal(plus.priceYearUzs ?? plus.priceYearly ?? 199990, 199990);
  const free = cards.find((c) => c.tier === 'free')! as { features: string[] };
  assert.ok(free.features.some((f) => /50 free pages of imports a month/.test(f)), free.features.join('|'));
  assert.ok(!JSON.stringify(cards).includes('pages of imports a day'));
  const uz = await buildPlanCards(mk(daily), 'uz');
  assert.ok(JSON.stringify(uz).includes('Oyiga 50 sahifagacha')); assert.ok(!JSON.stringify(uz).includes('Kuniga 50 sahifa'));
  console.log('kai61a-plans-price-cycle: OK');
})().catch((e) => { console.error(e); process.exit(1); });
