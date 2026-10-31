// PAYMENTS P0–P2 server side: stable error codes, expiry, double-submit reuse, unified history. Mocked prisma/Atmos only.
process.env.PAYMENTS_UI_ENABLED = 'true'; // r3b on final-5: payments-02 flows run with the payments UI on (off case: payments-final5.test)
import * as assert from 'node:assert/strict';
import { BadRequestException, ConflictException, ServiceUnavailableException } from '@nestjs/common';
import { BillingErrorFilter, classifyBillingError } from './billing-errors';
import { ImportCommerceService, toPlaySummary } from './import-commerce.service';

// --- classifier: every server message the web can see maps to a code
const cases: Array<[string, string]> = [
  ['Card number must be 16–19 digits.', 'card_format'],
  ['Invalid expiry month. Use MM/YY (e.g. 03/30).', 'card_format'],
  ['OTP must be 4–8 digits.', 'otp_format'],
  ['Invalid card number or expiry. Check the number and use expiry as MM/YY (e.g. 03/30).', 'card_invalid'],
  ['This card has expired. Please use a different card.', 'card_expired'],
  ['Insufficient funds on this card.', 'insufficient_funds'],
  ['Card verification failed. Please check your card details and try again.', 'card_failed'],
  ['Incorrect SMS code. Please check the code and try again.', 'otp_wrong'],
  ['SMS code expired. Tap "Resend Code" and enter the new code.', 'otp_expired'],
  ['Too many incorrect attempts. Request a new SMS code or use a different card.', 'otp_attempts'],
  ['This payment session has expired. Go back and start checkout again.', 'session_expired'],
  ['Payment could not be completed due to a billing system error. Please try again in a few minutes or contact support.', 'provider_error'],
  ['Payment amount is below the minimum allowed for card payments. Please contact support.', 'amount_not_allowed'],
  ['Payment could not be processed for this import. Please try again later or contact support.', 'amount_not_allowed'],
  ['Payment terminal is not configured correctly. Please try again in a few minutes or contact support.', 'gateway_unavailable'],
  ['Atmos payment gateway is not configured', 'gateway_unavailable'],
  ['This import length is not priced yet. Try a shorter document or try again later.', 'not_priced'],
  ['Payment is already completed', 'payment_completed'],
  ['Payment not found', 'payment_not_found'],
];
for (const [m, c] of cases) assert.equal(classifyBillingError(m), c, m);
assert.equal(classifyBillingError('something else'), null);

// --- filter: adds code, keeps explicit code
function run(ex: any) {
  let out: any; let st = 0;
  new BillingErrorFilter().catch(ex, { switchToHttp: () => ({ getResponse: () => ({ status: (n: number) => { st = n; return { json: (b: unknown) => { out = b; } }; } }) }) } as any);
  return { st, out };
}
assert.equal(run(new ServiceUnavailableException('Insufficient funds on this card.')).out.code, 'insufficient_funds');
assert.equal(run(new ConflictException({ message: 'x', code: 'payment_not_pending' })).out.code, 'payment_not_pending');
assert.equal(run(new BadRequestException('nope')).out.code, undefined);
assert.equal(run(new BadRequestException('nope')).st, 400);

// --- service with in-memory prisma
const now = Date.now();
const rows: any[] = [];
let atmosCalls = 0;
const prisma: any = {
  importPayment: {
    findFirst: async ({ where }: any) => rows.filter((r) =>
      (!where.id || r.id === where.id) && (!where.userId || r.userId === where.userId) &&
      (!where.status || r.status === where.status) && (!where.importType || r.importType === where.importType) &&
      (where.estimatedPages == null || r.estimatedPages === where.estimatedPages) &&
      (where.amountTiyins == null || r.amountTiyins === where.amountTiyins) &&
      (!where.account?.startsWith || r.account.startsWith(where.account.startsWith)) &&
      (!where.expiresAt?.gt || r.expiresAt > where.expiresAt.gt)).sort((a, b) => b.createdAt - a.createdAt)[0] ?? null,
    updateMany: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id && x.status === where.status); if (!r) return { count: 0 }; Object.assign(r, data); return { count: 1 }; },
    findMany: async () => rows.filter((r) => r.amountTiyins > 0).sort((a, b) => b.createdAt - a.createdAt),
    create: async () => { throw new Error('must not create a second payment'); },
  },
  entitlement: { findMany: async () => [{ id: 'a1', kind: 'plus', source: 'admin', status: 'active', contentId: null, createdAt: new Date(now - 5_000_000_000), expiresAt: new Date(now + 1e9) }], findFirst: async () => null },
  platformSetting: { findMany: async () => [] },
  playPurchase: { findMany: async () => [{ id: 'g1', sku: 'import_tier_1_10', kind: 'import_tier', state: 'purchased', createdAt: new Date(now - 1000) }] },
};
const atmos: any = new Proxy({ minAmountTiyins: () => 50_000, configured: () => true }, {
  get: (t: any, k) => (k in t ? t[k] : async () => { atmosCalls++; throw new Error('no live Atmos in tests'); }),
});

async function main() {
  const svc: any = new (ImportCommerceService as any)(prisma, atmos);
  rows.push(
    { id: 'old', userId: 'u', status: 'pending', importType: 'pdf', estimatedPages: 50, amountTiyins: 50_000, account: 'imp_old', providerPaymentId: null, expiresAt: new Date(now - 1), createdAt: new Date(now - 3_700_000), contentFormat: 'ebook', currency: 'UZS', paidAt: null, ofdUrl: null },
    { id: 'open', userId: 'u', status: 'pending', importType: 'pdf', estimatedPages: 50, amountTiyins: 50_000, account: 'imp_open', providerPaymentId: '8', expiresAt: new Date(now + 3_000_000), createdAt: new Date(now - 600_000), contentFormat: 'ebook', currency: 'UZS', paidAt: null, ofdUrl: null },
    { id: 'gone', userId: 'u', status: 'failed', importType: 'pdf', estimatedPages: 9, amountTiyins: 50_000, account: 'imp_gone', providerPaymentId: '9', expiresAt: new Date(now + 3_000_000), createdAt: new Date(now - 500_000), contentFormat: 'ebook', currency: 'UZS', paidAt: null, ofdUrl: null },
  );

  // P2 expiry: preApply on an expired session with no Atmos tx → session_expired, row marked expired, no Atmos call (PAY2-21 cases: pay2-21-retry-reconcile.test.ts)
  await assert.rejects(() => svc.preApply('u', 'old', '8600123412341234', '03/30'), (e: any) => e.getResponse().code === 'session_expired');
  assert.equal(rows[0].status, 'expired');
  // preApply on a cancelled (failed) payment is refused (was accepted before)
  await assert.rejects(() => svc.preApply('u', 'gone', '8600123412341234', '03/30'), (e: any) => e.getResponse().code === 'payment_not_pending');
  await assert.rejects(() => svc.retryOtp('u', 'gone'), (e: any) => e.getResponse().code === 'payment_not_pending');
  assert.equal(atmosCalls, 0);

  // P1 double-submit: checkout reuses the open pending payment (create would throw)
  svc.quote = async () => ({ requiresPayment: true, amountTiyins: 50_000, importType: 'pdf', estimatedPages: 50, contentFormat: 'ebook', listAmountUzs: 500, promo: null });
  const co = await svc.checkout('u', { importType: 'pdf' });
  assert.equal(co.paymentId, 'open'); assert.equal(co.reused, true); assert.equal(co.step, 'card');
  assert.equal(atmosCalls, 0, 'no second Atmos transaction');

  // unified history
  const h = await svc.listAllPayments('u', { limit: 2 });
  assert.equal(h.items.length, 2);
  assert.equal(h.items[0].id, 'g1'); assert.equal(h.items[0].source, 'google_play'); assert.equal(h.items[0].amountUzs, 0);
  assert.ok(h.nextCursor);
  const all = await svc.listAllPayments('u', { limit: 10 });
  assert.equal(all.items.find((i: any) => i.id === 'old').needsAttention, false, 'expired rows are not "needs attention"');
  const grant = all.items.find((i: any) => i.id === 'a1');
  assert.equal(grant.kind, 'admin_grant'); assert.equal(grant.amountUzs, 0); assert.ok(grant.endsAt);
  assert.equal(toPlaySummary({ id: 'x', sku: 's', kind: 'catalog_book', state: 'revoked', createdAt: new Date() }).status, 'refunded');
  console.log('payments-flow.test: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
