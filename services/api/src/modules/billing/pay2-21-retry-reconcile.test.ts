// PAY2-21: a learner retry after the 60-minute window reconciles with Atmos (mocked) or flags for manual review;
// it never expires a payment that may have been charged without asking Atmos first.
process.env.PAYMENTS_UI_ENABLED = 'true'; // r3b on final-5: payments-02 flows run with the payments UI on (off case: payments-final5.test)
import * as assert from 'node:assert/strict';
import { ImportCommerceService } from './import-commerce.service';

const now = Date.now();
type Row = any;
function setup(atmosAnswer: 'confirmed' | 'declined' | 'down' | 'vague' | 'unconfigured') {
  const rows: Row[] = [{ id: 'p', userId: 'u', status: 'pending', account: 'imp_p', providerPaymentId: '77', expiresAt: new Date(now - 61 * 60_000), needsAttention: false, amountTiyins: 2_499_000 }];
  const prisma: any = { importPayment: {
    findFirst: async ({ where }: any) => rows.find((r) => r.id === where.id && (!where.userId || r.userId === where.userId)) ?? null,
    findUnique: async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null,
    updateMany: async ({ where, data }: any) => { const r = rows.find((x) => x.id === where.id && (!where.status || x.status === where.status)); if (!r) return { count: 0 }; Object.assign(r, data); return { count: 1 }; },
  } };
  const calls = { get: 0, charge: 0, markPaid: [] as any[] };
  const atmos: any = new Proxy({
    configured: () => atmosAnswer !== 'unconfigured', minAmountTiyins: () => 50_000,
    getTransaction: async (tx: number) => {
      calls.get++; assert.equal(tx, 77);
      if (atmosAnswer === 'down') throw new Error('ETIMEDOUT');
      if (atmosAnswer === 'confirmed') return { confirmed: true, ofdUrl: 'https://ofd/x', raw: { store_transaction: { confirmed: true } } };
      if (atmosAnswer === 'declined') return { confirmed: false, ofdUrl: null, raw: { store_transaction: { confirmed: false } } };
      return { confirmed: false, ofdUrl: null, raw: { result: { code: 'OK' } } };
    },
  }, { get: (t: any, k) => (k in t ? t[k] : async () => { calls.charge++; throw new Error('must not start a new Atmos charge'); }) });
  const svc: any = new (ImportCommerceService as any)(prisma, atmos);
  svc.markPaid = async (account: string, opts: any) => { calls.markPaid.push({ account, opts }); rows[0].status = 'paid'; return true; };
  return { svc, rows, calls };
}
const code = (c: string) => (e: any) => e.getResponse().code === c;

async function main() {
  for (const step of ['preApply', 'retryOtp'] as const) {
    const call = (svc: any) => step === 'preApply' ? svc.preApply('u', 'p', '8600123412341234', '03/30') : svc.retryOtp('u', 'p');

    // Atmos says charged → paid via markPaid(late), learner told it is completed; no new charge
    let t = setup('confirmed');
    await assert.rejects(() => call(t.svc), code('payment_completed'));
    assert.equal(t.calls.markPaid.length, 1); assert.equal(t.calls.markPaid[0].account, 'imp_p'); assert.equal(t.calls.markPaid[0].opts.late, true);
    assert.equal(t.rows[0].status, 'paid'); assert.equal(t.calls.charge, 0);

    // Atmos definitively not charged → expired, "start again"
    t = setup('declined');
    await assert.rejects(() => call(t.svc), code('session_expired'));
    assert.equal(t.rows[0].status, 'expired'); assert.equal(t.rows[0].needsAttention, false); assert.equal(t.calls.charge, 0);

    // Atmos down / not configured / no definitive answer → stays pending, flagged for manual review
    for (const a of ['down', 'unconfigured', 'vague'] as const) {
      t = setup(a);
      await assert.rejects(() => call(t.svc), code('payment_under_review'));
      assert.equal(t.rows[0].status, 'pending', a); assert.equal(t.rows[0].needsAttention, true, a);
      assert.equal(t.calls.charge, 0, a); assert.equal(t.calls.markPaid.length, 0, a);
      assert.equal(t.calls.get, a === 'unconfigured' ? 0 : 1, a);
    }
  }

  // No Atmos transaction ever created → nothing can be charged → expired without an Atmos call
  const t = setup('down'); t.rows[0].providerPaymentId = null;
  await assert.rejects(() => t.svc.preApply('u', 'p', '8600123412341234', '03/30'), code('session_expired'));
  assert.equal(t.rows[0].status, 'expired'); assert.equal(t.calls.get, 0);
  console.log('pay2-21 retry-after-expiry reconcile: OK');
}
main().catch((e) => { console.error(e); process.exit(1); });
