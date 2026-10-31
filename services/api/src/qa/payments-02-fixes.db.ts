/* PAY2-01 / PAY2-04 DB-backed checks against a THROWAWAY local Postgres (QA_DB). Mocked Atmos; network forbidden.
 * Run: QA_DB=postgresql://…/throwaway npx ts-node --transpile-only src/qa/payments-02-fixes.db.ts */
process.env.ATMOS_API_KEY = 'qa-dummy-not-a-key'; process.env.ATMOS_STORE_ID = '999';
process.env.ATMOS_SANDBOX = 'true'; process.env.PAYMENT_GATEWAY_ENABLED = 'true'; process.env.NODE_ENV = 'test';
(globalThis as any).fetch = async () => { throw new Error('NETWORK FORBIDDEN'); };
import { createHash, randomUUID } from 'crypto';
import { PrismaClient, ImportPaymentStatus as S } from '@prisma/client';
import { ImportCommerceService } from '../modules/billing/import-commerce.service';
import { AtmosClient } from '../modules/billing/atmos.client';
import { LimitsService } from '../services/limits.service';
import { resetPlanCapsCache, usageDayStart } from '../common/plan-caps';

if (!process.env.QA_DB || /55433|prod|staging/i.test(process.env.QA_DB)) throw new Error('QA_DB must be a throwaway DB');
const prisma = new PrismaClient({ datasources: { db: { url: process.env.QA_DB } } });
let fails = 0;
const check = (n: string, ok: boolean, info = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${info}`); };

function atmos(state: { down: boolean; confirmed: boolean; reverses: number }) {
  const m: any = Object.create(new AtmosClient());
  m.configured = () => true; m.mode = () => 'test';
  m.getTransaction = async (id: number) => { if (state.down) throw new Error('atmos down'); return { transactionId: id, confirmed: state.confirmed, raw: { store_transaction: { confirmed: state.confirmed } } }; };
  m.reverseTransaction = async (p: any) => { state.reverses++; return { transactionId: p.transactionId, raw: {} }; };
  return m as AtmosClient;
}
const sign = (o: any) => createHash('md5').update(`${o.store_id}${o.transaction_id}${o.invoice}${o.amount}qa-dummy-not-a-key`).digest('hex');
const cb = (p: any) => { const o: any = { store_id: 999, transaction_id: p.providerPaymentId, invoice: p.account, amount: p.amountTiyins }; o.sign = sign(o); return o; };
const mkUser = () => prisma.user.create({ data: { email: `fix+${randomUUID()}@test.local`, nativeLanguage: 'uz' as any } });
const mkStale = (userId: string) => prisma.importPayment.create({ data: { userId, account: `plus_30_${randomUUID().slice(0, 12)}`, amountTiyins: 2499000, currency: 'UZS', estimatedPages: 0, contentFormat: 'plus_pass:30', importType: 'paste' as any, status: S.pending, provider: 'atmos', providerPaymentId: String(Math.floor(Math.random() * 1e9)), expiresAt: new Date(Date.now() - 61 * 60_000) } });
const plusEnts = (paymentId: string) => prisma.entitlement.count({ where: { importPaymentId: paymentId, kind: 'plus', status: 'active' } });

async function main() {
  // PAY2-01 repro: Atmos down at expiry → stays pending; late callback → Plus granted once.
  { const st = { down: true, confirmed: true, reverses: 0 }; const svc = new ImportCommerceService(prisma as any, atmos(st));
    const u = await mkUser(); const p = await mkStale(u.id);
    const r = await svc.expireStalePending();
    const after = await prisma.importPayment.findUniqueOrThrow({ where: { id: p.id } });
    check('PAY2-01 Atmos down → stays pending (deferred)', after.status === S.pending && r.deferred >= 1, JSON.stringify(r));
    const res = await Promise.all([1, 2, 3].map(() => svc.handleAtmosCallback(cb(p))));
    const fin = await prisma.importPayment.findUniqueOrThrow({ where: { id: p.id } });
    check('PAY2-01 late callback → paid, exactly 1 Plus entitlement, 0 reverses', fin.status === S.paid && (await plusEnts(p.id)) === 1 && st.reverses === 0 && res.every((x) => x.status === 1)); }
  // 24 h cap: expired + needsAttention, late callback still grants once
  { const st = { down: true, confirmed: true, reverses: 0 }; const svc = new ImportCommerceService(prisma as any, atmos(st));
    const u = await mkUser(); const p = await mkStale(u.id);
    await svc.expireStalePending(new Date(Date.now() + 25 * 3_600_000));
    const e = await prisma.importPayment.findUniqueOrThrow({ where: { id: p.id } });
    check('PAY2-01 24h cap → expired + needsAttention', e.status === S.expired && e.needsAttention);
    await Promise.all([svc.handleAtmosCallback(cb(p)), svc.handleAtmosCallback(cb(p))]);
    const fin = await prisma.importPayment.findUniqueOrThrow({ where: { id: p.id } });
    check('PAY2-01 late callback on expired → paid, 1 Plus entitlement', fin.status === S.paid && (await plusEnts(p.id)) === 1 && st.reverses === 0); }
  // confirmed non-paid → expired; Atmos confirmed → paid
  { const st = { down: false, confirmed: false, reverses: 0 }; const svc = new ImportCommerceService(prisma as any, atmos(st));
    const u = await mkUser(); const p = await mkStale(u.id); await svc.expireStalePending();
    check('PAY2-01 Atmos says not paid → expired', (await prisma.importPayment.findUniqueOrThrow({ where: { id: p.id } })).status === S.expired);
    st.confirmed = true; const q = await mkStale(u.id); await svc.expireStalePending();
    check('PAY2-01 Atmos says paid → paid + Plus', (await prisma.importPayment.findUniqueOrThrow({ where: { id: q.id } })).status === S.paid && (await plusEnts(q.id)) === 1); }
  // refunded / failed never resurrected by a late callback
  { const st = { down: false, confirmed: true, reverses: 0 }; const svc = new ImportCommerceService(prisma as any, atmos(st));
    const u = await mkUser();
    for (const s of [S.failed, S.refunded]) { const p = await mkStale(u.id); await prisma.importPayment.update({ where: { id: p.id }, data: { status: s } });
      const r = await svc.handleAtmosCallback(cb(p)); const f = await prisma.importPayment.findUniqueOrThrow({ where: { id: p.id } });
      check(`PAY1 guarantee: ${s} not resurrected`, r.status === 0 && f.status === s); } }
  // PAY2-04: 40 parallel reservations, Free cap 10 → exactly 10, counter 10
  { resetPlanCapsCache(); const u = await mkUser(); const limits = new LimitsService(prisma as any);
    const rs = await Promise.allSettled(Array.from({ length: 40 }, () => limits.reserveQuizSlot(u.id)));
    const ok = rs.filter((r) => r.status === 'fulfilled').length;
    const row = await prisma.aiUsageDaily.findUnique({ where: { userId_usageDate: { userId: u.id, usageDate: usageDayStart() } } });
    const all429 = rs.filter((r) => r.status === 'rejected').every((r: any) => r.reason?.getStatus?.() === 429);
    check('PAY2-04 40 parallel quiz starts (Free 10) → 10 granted, counter 10, rest 429', ok === 10 && row?.quizCount === 10 && all429, `ok=${ok} count=${row?.quizCount}`); }
  await prisma.$disconnect();
  console.log(fails ? `FAILED ${fails}` : 'payments-02-fixes.db: all passed');
  process.exit(fails ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
