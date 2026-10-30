// REVIEW-p1 B2, B3, M1, M2, M3 + QA BUG-06/07 on an in-memory Prisma fake that honours conditional writes.
import * as assert from 'node:assert/strict';
import { ImportPaymentStatus as S, PurchaseStatus, Prisma } from '@prisma/client';
import { ImportCommerceService } from './import-commerce.service';

type Row = Record<string, any>;
const match = (r: Row, w: Row = {}) =>
  Object.entries(w).every(([k, v]) => (k === 'OR' ? (v as Row[]).some((x) => match(r, x)) : v && typeof v === 'object' && !(v instanceof Date) ? true : r[k] === v));

function fakeDb(payment: Row) {
  const payments: Row[] = [payment];
  const purchases: Row[] = [];
  const audit: Row[] = [];
  const atmosCalls: string[] = [];
  let failAudit = false;
  const table = (rows: Row[], uniq?: string) => ({
    findUnique: async ({ where }: any) => rows.find((r) => match(r, where)) ?? null,
    findFirst: async ({ where }: any) => rows.find((r) => match(r, where)) ?? null,
    findFirstOrThrow: async ({ where }: any) => rows.find((r) => match(r, where))!,
    findMany: async ({ where }: any) => rows.filter((r) => match(r, where)),
    updateMany: async ({ where, data }: any) => {
      const hit = rows.filter((r) => match(r, where));
      hit.forEach((r) => Object.assign(r, data));
      return { count: hit.length };
    },
    update: async ({ where, data }: any) => Object.assign(rows.find((r) => match(r, where))!, data),
    create: async ({ data }: any) => {
      if (uniq && data[uniq] && rows.some((r) => r[uniq] === data[uniq])) {
        throw new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
      }
      if (rows === audit && failAudit) throw new Error('audit write failed');
      rows.push({ ...data });
      return data;
    },
  });
  const db: any = {
    importPayment: table(payments),
    contentPurchase: table(purchases, 'importPaymentId'),
    auditLog: table(audit),
    contentItem: { update: async () => ({}) },
  };
  // $transaction: callback form gets a snapshot-rollback; array form runs sequentially.
  db.$transaction = async (arg: any) => {
    if (Array.isArray(arg)) { const out = []; for (const p of arg) out.push(await p); return out; }
    const snap = JSON.stringify({ payments, purchases });
    try { return await arg(db); } catch (e) {
      const back = JSON.parse(snap); payments.splice(0, payments.length, ...back.payments); purchases.splice(0, purchases.length, ...back.purchases);
      throw e;
    }
  };
  const atmos: any = {
    mode: () => (process.env.ATMOS_SANDBOX === undefined ? null : process.env.ATMOS_SANDBOX === 'true' ? 'test' : 'live'),
    configured: () => true,
    reverseFails: false,
    confirmed: true,
    reverseTransaction: async () => { atmosCalls.push('reverse'); if (atmos.reverseFails) throw new Error('atmos down'); return {}; },
    applyTransaction: async () => { atmosCalls.push('apply'); return { confirmed: atmos.confirmed, raw: {} }; },
    getTransaction: async () => ({ confirmed: atmos.confirmed, raw: {} }),
  };
  const svc = new ImportCommerceService(db, atmos);
  return { svc, db, payments, purchases, audit, atmos, atmosCalls, setFailAudit: (v: boolean) => (failAudit = v) };
}
const CAT = 'catalog:11111111-1111-4111-8111-111111111111';
const pay = (o: Row = {}): Row => ({ id: 'p1', userId: 'u1', status: S.paid, providerPaymentId: '42', contentFormat: CAT, amountTiyins: 100_00, account: 'acc1', ...o });

async function main() {
  // BUG-06/07: learner cancel only for pending; never rewrites history
  for (const status of [S.paid, S.refunded, S.failed, S.refunding]) {
    const f = fakeDb(pay({ status }));
    await assert.rejects(f.svc.cancelPayment('u1', 'p1'), (e: any) => e.getStatus() === 409);
    assert.equal(f.payments[0].status, status);
  }

  // B2: claim → reverse(idempotency key) → finalize + audit; second click is a 409 / no-op
  {
    const f = fakeDb(pay());
    f.purchases.push({ importPaymentId: 'p1', userId: 'u1', status: PurchaseStatus.completed });
    f.purchases.push({ importPaymentId: 'other', userId: 'u1', status: PurchaseStatus.completed }); // M3: separately paid
    const [a, b] = await Promise.allSettled([
      f.svc.refundPaidPayment('p1', { reason: 'dup', actorId: 'admin' }),
      f.svc.refundPaidPayment('p1', { reason: 'dup', actorId: 'admin' }),
    ]);
    assert.equal([a, b].filter((x) => x.status === 'fulfilled').length, 1, 'exactly one refund wins');
    assert.deepEqual(f.atmosCalls, ['reverse'], 'Atmos reversed once');
    assert.equal(f.payments[0].status, S.refunded);
    assert.equal(f.purchases[0].status, PurchaseStatus.refunded);
    assert.equal(f.purchases[1].status, PurchaseStatus.completed, 'M3: other purchase untouched');
    assert.equal(f.audit.length, 1);
    const again = await f.svc.refundPaidPayment('p1', { reason: 'dup', actorId: 'admin' });
    assert.equal(again.alreadyRefunded, true, 'retry returns existing result');
    assert.deepEqual(f.atmosCalls, ['reverse']);
  }
  // B2: Atmos failure rolls the claim back to paid (+ flagged), nothing revoked, no audit
  {
    const f = fakeDb(pay());
    f.atmos.reverseFails = true;
    await assert.rejects(f.svc.refundPaidPayment('p1', { reason: 'x1x', actorId: 'a' }), /atmos down/);
    assert.equal(f.payments[0].status, S.paid);
    assert.equal(f.payments[0].needsAttention, true);
    assert.equal(f.audit.length, 0);
  }
  // B2: audit failure rolls back the finalize (stays refunding → reconciler)
  {
    const f = fakeDb(pay());
    f.setFailAudit(true);
    await assert.rejects(f.svc.refundPaidPayment('p1', { reason: 'x1x', actorId: 'a' }));
    assert.equal(f.payments[0].status, S.refunding);
  }

  // M1: no transaction + mode unset/live ⇒ refused; explicit test mode ⇒ local refund
  {
    delete process.env.ATMOS_SANDBOX;
    let f = fakeDb(pay({ providerPaymentId: null }));
    await assert.rejects(f.svc.refundPaidPayment('p1', { reason: 'x1x', actorId: 'a' }), (e: any) => e.getStatus() === 409);
    process.env.ATMOS_SANDBOX = 'false';
    f = fakeDb(pay({ providerPaymentId: null }));
    await assert.rejects(f.svc.refundPaidPayment('p1', { reason: 'x1x', actorId: 'a' }), (e: any) => e.getStatus() === 409);
    process.env.ATMOS_SANDBOX = 'true';
    f = fakeDb(pay({ providerPaymentId: null }));
    const r = await f.svc.refundPaidPayment('p1', { reason: 'x1x', actorId: 'a' });
    assert.equal(r.reversedAtAtmos, false);
    delete process.env.ATMOS_SANDBOX;
  }

  // B3: cancel → apply is refused before Atmos is called
  {
    const f = fakeDb(pay({ status: S.pending }));
    f.atmos.confirmed = false;
    await f.svc.cancelPayment('u1', 'p1');
    await assert.rejects(f.svc.apply('u1', 'p1', '123456'), (e: any) => e.getStatus() === 409);
    assert.ok(!f.atmosCalls.includes('apply'));
  }
  // B3: refund → poll / webhook never flips back to paid
  {
    const f = fakeDb(pay({ status: S.refunded }));
    await f.svc.getPayment('u1', 'p1');
    assert.equal(await f.svc.markPaid('acc1', { providerRef: '42' }), null);
    assert.equal(f.payments[0].status, S.refunded);
  }
  // B3 race: payment cancelled while the OTP is in flight ⇒ charge reversed, stays failed
  {
    const f = fakeDb(pay({ status: S.pending }));
    f.atmos.applyTransaction = async () => { f.payments[0].status = S.failed; return { confirmed: true, raw: {} }; };
    await assert.rejects(f.svc.apply('u1', 'p1', '123456'), (e: any) => e.getStatus() === 409);
    assert.equal(f.payments[0].status, S.failed);
    assert.ok(f.atmosCalls.includes('reverse'));
  }
  // M3: concurrent webhook + poll + apply ⇒ one paid transition, one purchase
  {
    const f = fakeDb(pay({ status: S.pending }));
    await Promise.all([f.svc.markPaid('acc1', {}), f.svc.markPaid('acc1', {}), f.svc.getPayment('u1', 'p1')]);
    assert.equal(f.purchases.length, 1);
  }
  // M2: page-count void with a failed reverse stays paid + flagged
  {
    const f = fakeDb(pay());
    f.atmos.reverseFails = true;
    await (f.svc as any).voidUnusedPayment('p1');
    assert.equal(f.payments[0].status, S.paid);
    assert.equal(f.payments[0].needsAttention, true);
  }
  // B2 reconciler: stale refunding row; Atmos shows reversed ⇒ finalized
  {
    const f = fakeDb(pay({ status: S.refunding, refundRequestedAt: new Date(0), refundReason: 'x' }));
    f.atmos.confirmed = false;
    f.db.importPayment.findMany = async () => [f.payments[0]];
    const r = await f.svc.reconcileStaleRefunds(0);
    assert.equal(r.finalized, 1);
    assert.equal(f.payments[0].status, S.refunded);
  }
  console.log('review-p1 payments: all passed');
}
main().catch((e) => { console.error(e); process.exit(1); });
