/**
 * final-6.1b-r2 (no DB, mocked Atmos — no network): a failed PAID import is auto-reversed by default.
 * finalizeFailure → settleFailedImportPayment → importRefundReverser → atmos.reverseTransaction with the
 * successTransId from /pay/get and our payment id as Idempotency-Key. Kill switch and unconfigured Atmos
 * fall back to refund_state 'due' + needsAttention. Paste validation runs before the payment is consumed.
 */
import * as assert from 'node:assert/strict';
import { ImportCommerceService } from '../billing/import-commerce.service';
import { ImportsService } from './imports.service';

function setup(opts: { configured?: boolean; reverseThrows?: boolean; successTransId?: number } = {}) {
  const payment: any = { id: 'pay1', userImportId: 'ui1', status: 'paid', amountTiyins: 500000, providerPaymentId: '777', refundState: null, needsAttention: false };
  const calls: any[] = [];
  const atmos: any = {
    configured: () => opts.configured ?? true,
    getTransaction: async (id: number) => (opts.successTransId ? { successTransId: opts.successTransId, id } : null),
    reverseTransaction: async (p: any) => { calls.push(p); if (opts.reverseThrows) throw new Error('Atmos 500'); return { transactionId: p.transactionId }; },
  };
  const match = (row: any, where: any) => Object.entries(where).every(([k, v]) => row[k] === v);
  const prisma: any = {
    userImport: { updateMany: async () => ({ count: 1 }), findUnique: async () => ({ id: 'ui1', queueJob: null }) },
    ingestionJob: { updateMany: async () => ({ count: 0 }) },
    importPayment: {
      findFirst: async ({ where }: any) => (where.userImportId === payment.userImportId ? { ...payment } : null),
      updateMany: async ({ where, data }: any) => { if (!match(payment, where)) return { count: 0 }; Object.assign(payment, data); return { count: 1 }; },
    },
  };
  const commerce = Object.create(ImportCommerceService.prototype) as any;
  commerce.atmos = atmos; commerce.prisma = prisma;
  commerce.finalizeManualRefund = async () => {
    payment.status = 'refunded';
    payment.refundState = 'refunded';
    payment.needsAttention = false;
    return { id: payment.id, status: 'refunded', already: false, accessRevoked: 0 };
  };
  const svc = Object.create(ImportsService.prototype) as any;
  svc.prisma = prisma; svc.atmos = atmos; svc.importCommerce = commerce;
  svc.logger = { warn() {}, log() {}, error() {} };
  return { svc, payment, calls };
}

(async () => {
  const saved = process.env.IMPORT_REFUND_LIVE_REVERSE;
  try {
    delete process.env.IMPORT_REFUND_LIVE_REVERSE;
    // 1. default: reversed at Atmos using successTransId + idempotency key, exactly once
    {
      const { svc, payment, calls } = setup({ successTransId: 9001 });
      const r = await svc.finalizeFailure('ui1', new Error('Could not extract text'));
      assert.equal(r.action, 'refunded');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].transactionId, 9001);
      assert.equal(calls[0].idempotencyKey, 'pay1');
      assert.equal(payment.status, 'refunded');
      assert.equal(payment.refundState, 'refunded');
      assert.equal((await svc.finalizeFailure('ui1', new Error('again'))).action, 'none');
      assert.equal(calls.length, 1, 'never reversed twice');
    }
    // 2. no successTransId → falls back to the transaction id
    {
      const { svc, calls } = setup();
      await svc.finalizeFailure('ui1', new Error('x'));
      assert.equal(calls[0].transactionId, 777);
    }
    // 3. Atmos error stays refunding + reverse_unknown, and is not reversed again
    {
      const { svc, payment, calls } = setup({ reverseThrows: true });
      assert.equal((await svc.finalizeFailure('ui1', new Error('x'))).action, 'reverse_failed');
      assert.equal(payment.refundState, 'reverse_unknown');
      assert.equal(payment.needsAttention, true);
      assert.equal(payment.status, 'refunding');
      assert.equal((await svc.finalizeFailure('ui1', new Error('x'))).action, 'none');
      assert.equal(calls.length, 1);
    }
    // 4. Atmos not configured → no call, due + needsAttention
    {
      const { svc, payment, calls } = setup({ configured: false });
      assert.equal((await svc.finalizeFailure('ui1', new Error('x'))).action, 'refund_due');
      assert.equal(calls.length, 0);
      assert.equal(payment.needsAttention, true);
    }
    // 5. kill switch
    {
      process.env.IMPORT_REFUND_LIVE_REVERSE = 'false';
      const { svc, payment, calls } = setup();
      assert.equal((await svc.finalizeFailure('ui1', new Error('x'))).action, 'refund_due');
      assert.equal(calls.length, 0);
      assert.equal(payment.refundState, 'due');
      assert.equal(payment.needsAttention, true);
      delete process.env.IMPORT_REFUND_LIVE_REVERSE;
    }
    // 6. paste: invalid text is rejected BEFORE the payment is consumed
    {
      const svc = Object.create(ImportsService.prototype) as any;
      let consumed = 0;
      svc.limits = { assertImportAllowed: async () => undefined };
      svc.resolveImportLanguage = async () => 'en';
      svc.importCommerce = { consumePayment: async () => { consumed++; return null; }, estimatePages: () => 1 };
      await assert.rejects(svc.importPaste('u', { title: 't', text: 'too short', paymentId: 'pay1' }));
      assert.equal(consumed, 0);
    }
  } finally {
    if (saved === undefined) delete process.env.IMPORT_REFUND_LIVE_REVERSE; else process.env.IMPORT_REFUND_LIVE_REVERSE = saved;
  }
  console.log('f61b-r2-refund: OK');
})().catch((e) => { console.error(e); process.exit(1); });
