// quote(): a tier priced 0 (live 901–1500) must be "not priced", never charged 0 or shown as 0 soʻm. Mocked prisma/Atmos only.
import * as assert from 'node:assert/strict';
import { ImportCommerceService } from './import-commerce.service';

const tiers = [
  { id: 'a', label: '1 - 100 pages', minPages: 1, maxPages: 100, priceUsd: 500, sortOrder: 1, active: true },
  { id: 'z', label: '901 - 1500 pages', minPages: 901, maxPages: 1500, priceUsd: 0, sortOrder: 6, active: true },
];
const prisma: any = {
  importPageTier: { findMany: async () => tiers },
  entitlement: { findFirst: async () => null },
  platformSetting: { findUnique: async () => ({ value: { dailyFreeImportsPerUser: 0, monthlyFreePageLimit: 0, allowedFormats: [], resetCycle: 'daily' } }) },
  importPayment: { findMany: async () => [], count: async () => 0, aggregate: async () => ({ _sum: { estimatedPages: 0 } }) },
  userImport: { count: async () => 0, findMany: async () => [] },
};
let atmosCalls = 0;
const atmos: any = new Proxy({ minAmountTiyins: () => 50_000, configured: () => true }, {
  get: (t: any, k) => (k in t ? t[k] : () => { atmosCalls++; throw new Error('no live Atmos in tests'); }),
});

async function main() {
  process.env.PAYMENT_GATEWAY_ENABLED = 'true';
  delete process.env.IMPORTS_UNLIMITED;
  const svc: any = new (ImportCommerceService as any)(prisma, atmos, undefined, undefined, undefined);
  svc.learnerAllowance = async () => ({ gatewayEnabled: true, resetCycle: 'daily', allowedFormats: [], dailyFreeImportsPerUser: 0, dailyFreeUsed: 0, dailyFreeRemaining: 0, monthlyFreePageLimit: 0, monthlyPagesUsed: 0, monthlyPagesRemaining: 0 });
  svc.estimatePages = (i: any) => i.pages;

  const ok = await svc.quote('u', { importType: 'pdf', pages: 50 });
  assert.equal(ok.tier.id, 'a');
  assert.equal(ok.amountTiyins, 50_000);
  assert.equal(ok.requiresPayment, true);

  const zero = await svc.quote('u', { importType: 'pdf', pages: 1000 });
  assert.equal(zero.tier, null, 'unpriced tier hidden from quote');
  assert.equal(zero.amountTiyins, 0);
  assert.equal(zero.freeReason, 'This length is not priced yet');
  await assert.rejects(() => svc.checkout('u', { importType: 'pdf', pages: 1000 }), /not priced/);
  assert.equal(atmosCalls, 0, 'no Atmos call for an unpriced tier');
  console.log('quote-tier-price.test: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
