/**
 * final-5 B4 + Kai: (a) with payments off (PAYMENT_GATEWAY_ENABLED unset, or IMPORTS_UNLIMITED/DEV_UNLIMITED_IMPORTS set) no Atmos create/pre-apply/apply/OTP can start for imports or
 * catalog (final-6: one flag; the old PAYMENTS_UI_ENABLED gate is gone); free-allowance
 * imports still work. (b) every confirmation path (apply, apply→"confirmed via get", getPayment poll, callback) settles
 * through one idempotent settlePaid: paid once, catalog granted exactly once, a paid-but-no-import payment stays
 * consumable exactly once (f29902f1). No Atmos credentials are read: the Atmos client is a fake.
 */
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { ImportCommerceService, assertPaymentsEnabled } from './import-commerce.service';

type Pay = Record<string, any>;
function harness() {
  const payments = new Map<string, Pay>();
  const purchases: any[] = [];
  const atmosCalls: string[] = [];
  const prisma: any = {
    importPayment: {
      findFirst: async ({ where }: any) => [...payments.values()].find((p) => p.id === where.id && (!where.userId || p.userId === where.userId)) ?? null,
      findFirstOrThrow: async ({ where }: any) => payments.get(where.id),
      findUnique: async ({ where }: any) => (where.id ? payments.get(where.id) : [...payments.values()].find((p) => p.account === where.account)) ?? null,
      findMany: async ({ where }: any) => [...payments.values()].filter((p) => p.userId === where.userId && p.status === where.status && p.userImportId === null && p.amountTiyins > 0 && !p.contentFormat.startsWith('catalog:')),
      updateMany: async ({ where, data }: any) => { const p = payments.get(where.id); if (p && p.status !== where.status.not) { Object.assign(p, data); return { count: 1 }; } return { count: 0 }; },
      update: async ({ where, data }: any) => Object.assign(payments.get(where.id)!, data),
      create: async ({ data }: any) => { const p = { id: `p${payments.size + 1}`, userImportId: null, ...data }; payments.set(p.id, p); return p; },
    },
    contentPurchase: {
      findFirst: async ({ where }: any) => purchases.find((x) => x.userId === where.userId && x.contentId === where.contentId) ?? null,
      create: (a: any) => ({ kind: 'cp', a }),
    },
    contentItem: { update: (a: any) => ({ kind: 'ci', a }) },
    entitlement: { createMany: (a: any) => ({ kind: 'ent', a }) },
    $transaction: async (ops: any[]) => { for (const o of ops) if (o.kind === 'cp') { if (purchases.some((x) => x.userId === o.a.data.userId && x.contentId === o.a.data.contentId)) throw new Prisma.PrismaClientKnownRequestError('unique', { code: 'P2002', clientVersion: 'test' }); purchases.push(o.a.data); } }, // r3b: mirrors the DB unique (user, content) the payments-02 grant relies on
  };
  const atmos: any = new Proxy({}, { get: (_t, k: string) => {
    if (k === 'configured') return () => true;
    if (k === 'minAmountTiyins') return () => 50_000;
    if (k === 'applyTransaction') return async () => { atmosCalls.push(k); return { confirmed: true, ofdUrl: 'ofd', raw: { via: 'get', code: 'STPIMS-ERR-092' } }; };
    if (k === 'getTransaction') return async () => { atmosCalls.push(k); return { confirmed: true, ofdUrl: 'ofd2', raw: {} }; };
    return async () => { atmosCalls.push(k); return { transactionId: 1 }; };
  } });
  const svc = new ImportCommerceService(prisma, atmos);
  return { svc, payments, purchases, atmosCalls };
}

(async () => {
  // (a) flag off — nothing can start; DEV_UNLIMITED_IMPORTS also forces off even with the gateway env on
  process.env.PAYMENT_GATEWAY_ENABLED = 'true'; process.env.DEV_UNLIMITED_IMPORTS = 'true';
  assert.throws(() => assertPaymentsEnabled(), /not available/);
  delete process.env.DEV_UNLIMITED_IMPORTS; delete process.env.PAYMENT_GATEWAY_ENABLED;
  assert.throws(() => assertPaymentsEnabled(), /not available/);
  process.env.PAYMENT_GATEWAY_ENABLED = 'true'; assert.doesNotThrow(() => assertPaymentsEnabled()); delete process.env.PAYMENT_GATEWAY_ENABLED;
  {
    const h = harness();
    (h.svc as any).quote = async () => ({ requiresPayment: true, amountTiyins: 2_900_000, importType: 'pdf', contentFormat: 'book', estimatedPages: 40, tier: { id: 't' } });
    await assert.rejects(() => h.svc.checkout('u', { importType: 'pdf' } as any), (e: any) => e.response?.code === 'PAYMENTS_DISABLED');
    h.payments.set('pp', { id: 'pp', userId: 'u', status: 'pending', providerPaymentId: '7', contentFormat: 'book', amountTiyins: 2_900_000, userImportId: null });
    await assert.rejects(() => h.svc.preApply('u', 'pp', '8600', '1230'), /not available/);
    await assert.rejects(() => h.svc.apply('u', 'pp', '111111'), /not available/);
    await assert.rejects(() => h.svc.retryOtp('u', 'pp'), /not available/);
    (h.svc as any).catalogAccess = async () => ({ accessGranted: false, priceUzs: 49000 });
    await assert.rejects(() => h.svc.catalogCheckout('u', 'c1'), /not available/);
    assert.deepEqual(h.atmosCalls, [], 'no Atmos call of any kind while the flag is off');
    // free allowance still works with the flag off
    (h.svc as any).quote = async () => ({ requiresPayment: false, amountTiyins: 0, importType: 'pdf', contentFormat: 'book', estimatedPages: 3, tier: null, isFree: true });
    const free = await h.svc.checkout('u', { importType: 'pdf' } as any);
    assert.equal(free.isFree, true); assert.equal(free.step, 'done');
    // already-granted catalog access is still returned (no payment)
    (h.svc as any).catalogAccess = async () => ({ accessGranted: true });
    assert.equal((await h.svc.catalogCheckout('u', 'c1')).step, 'done');
  }

  // (b) settlement paths, flag on
  process.env.PAYMENT_GATEWAY_ENABLED = 'true';
  {
    const h = harness();
    // f29902f1: import paid via apply → "confirmed via get"
    h.payments.set('f29902f1', { id: 'f29902f1', userId: 'u', status: 'pending', providerPaymentId: '9', account: 'a1', contentFormat: 'book', importType: 'pdf', amountTiyins: 2_900_000, userImportId: null });
    assert.equal((await h.svc.apply('u', 'f29902f1', '111111')).step, 'paid');
    assert.equal(h.payments.get('f29902f1')!.status, 'paid');
    assert.deepEqual((await h.svc.unusedPaidImports('u')).map((p: any) => p.id), ['f29902f1'], 'paid-but-no-import is listed for the learner');
    // callback after apply: idempotent, still success, no second transition
    const paidAt = h.payments.get('f29902f1')!.paidAt;
    await h.svc.markPaid('a1', { raw: { cb: 1 } });
    assert.equal(h.payments.get('f29902f1')!.paidAt, paidAt, 'second confirmation does not re-settle');
    // consumable exactly once
    const used = await h.svc.consumePayment('u', 'f29902f1', 'pdf' as any);
    assert.equal(used!.id, 'f29902f1');
    await h.svc.attachUserImport('f29902f1', 'imp1');
    await assert.rejects(() => h.svc.consumePayment('u', 'f29902f1', 'pdf' as any), /already used/);
    assert.deepEqual(await h.svc.unusedPaidImports('u'), []);

    // catalog: poll path + callback + apply-on-paid → exactly one grant
    h.payments.set('cat', { id: 'cat', userId: 'u', status: 'pending', providerPaymentId: '5', account: 'cat_1', contentFormat: 'catalog:c9', importType: 'pdf', amountTiyins: 4_900_000, userImportId: null });
    await h.svc.getPayment('u', 'cat');
    await h.svc.markPaid('cat_1');
    await h.svc.apply('u', 'cat', '000000');
    assert.equal(h.purchases.filter((p) => p.contentId === 'c9').length, 1, 'catalog granted exactly once');
    // paid-but-not-granted (8a26b7f3 shape) is repaired by any later confirmation
    h.payments.set('8a26b7f3', { id: '8a26b7f3', userId: 'u2', status: 'paid', providerPaymentId: '6', account: 'cat_2', contentFormat: 'catalog:c7', amountTiyins: 4_900_000, userImportId: null });
    await h.svc.markPaid('cat_2');
    await h.svc.markPaid('cat_2');
    assert.equal(h.purchases.filter((p) => p.contentId === 'c7').length, 1, 'repair grants once');
  }
  delete process.env.PAYMENT_GATEWAY_ENABLED; delete process.env.PAYMENT_GATEWAY_ENABLED;
  console.log('payments-final5.test: OK (flag off (unset or DEV_UNLIMITED) blocks import/catalog Atmos starts; PAYMENT_GATEWAY_ENABLED=true is the one ON switch; one idempotent settle path; f29902f1 consumable once; catalog grant once)');
})().catch((e) => { console.error(e); process.exit(1); });
