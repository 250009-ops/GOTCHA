/* PAY2-21 + PAY2-23 real-DB checks (from QA2 round-3 qa3-pay2-21; PAY2-23: review flag cleared on sweeper grant / definitive no) (throwaway qa_* DB, Atmos mocked, network forbidden). */
process.env.ATMOS_API_KEY = 'qa-dummy-not-a-key'; process.env.ATMOS_STORE_ID = '999';
process.env.ATMOS_SANDBOX = 'true'; process.env.PAYMENT_GATEWAY_ENABLED = 'true'; process.env.NODE_ENV = 'test';
process.env.AGE_UNKNOWN_BAND = 'adult'; delete process.env.OPENAI_API_KEY;
(globalThis as any).fetch = async () => { throw new Error('NETWORK FORBIDDEN'); };
import { createHash, randomUUID } from 'crypto';
import { PrismaClient, ImportPaymentStatus as S } from '@prisma/client';
import { ImportCommerceService, LATE_UNATTACHED } from '../modules/billing/import-commerce.service';
import { AtmosClient } from '../modules/billing/atmos.client';
if (!/127\.0\.0\.1:\d+\/qa_/.test(process.env.QA_DB ?? '')) throw new Error('QA_DB must be local qa_*');
const prisma: any = new PrismaClient({ datasources: { db: { url: process.env.QA_DB } } }); prisma.dbAvailable = true;
let fails = 0; const check = (n: string, ok: boolean, i = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); };
type St = { down: boolean; confirmed: boolean; noStore?: boolean; calls: number; applies: number };
function atmos(st: St) { const m: any = Object.create(new AtmosClient()); m.configured = () => true; m.mode = () => 'test';
  m.getTransaction = async (id: number) => { st.calls++; if (st.down) throw new Error('down'); return { transactionId: id, confirmed: st.confirmed, raw: st.noStore ? {} : { store_transaction: { confirmed: st.confirmed } } }; };
  m.preApplyTransaction = async () => { st.applies++; return { raw: {} }; }; m.applyTransaction = async () => { st.applies++; return { confirmed: true, raw: {} }; };
  m.retryOtp = async () => { st.applies++; return { raw: {} }; }; m.resendOtp = m.retryOtp; m.reverseTransaction = async () => ({ raw: {} }); return m as AtmosClient; }
const sign = (o: any) => createHash('md5').update(`${o.store_id}${o.transaction_id}${o.invoice}${o.amount}qa-dummy-not-a-key`).digest('hex');
const mkUser = () => prisma.user.create({ data: { email: `q3+${randomUUID()}@test.local`, nativeLanguage: 'uz' as any, birthYear: 1990 } as any }).catch(() => prisma.user.create({ data: { email: `q3+${randomUUID()}@test.local`, nativeLanguage: 'uz' as any } }));
const mkPay = (userId: string, fmt = 'article', minsAgo = 1) => prisma.importPayment.create({ data: { userId, account: `q3_${randomUUID().slice(0, 12)}`, amountTiyins: 1200000, currency: 'UZS', estimatedPages: fmt.startsWith('plus') ? 0 : 5, contentFormat: fmt, importType: 'paste' as any, status: S.pending, provider: 'atmos', providerPaymentId: String(1e6 + Math.floor(Math.random() * 1e9)), expiresAt: new Date(Date.now() - minsAgo * 60_000) } });
const get = (id: string) => prisma.importPayment.findUniqueOrThrow({ where: { id } });
const code = (e: any) => e?.response?.code ?? e?.getResponse?.()?.code ?? String(e?.message);
async function main() {
  await prisma.subscriptionPlan.deleteMany({}); await prisma.subscriptionPlan.createMany({ data: [{ tier: 'free', name: 'Free', aiDailyQuota: 20, importLimit: 3, quizDailyQuota: 10 }, { tier: 'premium', name: 'Plus', aiDailyQuota: 1000000, importLimit: 3, quizDailyQuota: 200 }] });
  // 1 Atmos confirmed, retry after expiry (apply/preApply/retryOtp) → payment_completed, paid, no new Atmos apply
  for (const step of ['apply', 'preApply', 'retryOtp'] as const) {
    const st: St = { down: false, confirmed: true, calls: 0, applies: 0 }; const svc: any = new ImportCommerceService(prisma, atmos(st));
    const u = await mkUser(); const p = await mkPay(u.id);
    const e = await (step === 'apply' ? svc.apply(u.id, p.id, '111111') : step === 'preApply' ? svc.preApply(u.id, p.id, '8600000000000000', '2912') : svc.retryOtp(u.id, p.id)).then((r: any) => r, (x: any) => x);
    const r = await get(p.id);
    check(`PAY2-21 ${step} after expiry, Atmos confirmed`, r.status === S.paid && st.applies === 0 && (step === 'apply' ? true : code(e) === 'payment_completed'), `status=${r.status} code=${code(e)} applies=${st.applies} cancelReason=${r.cancelReason}`);
    check(`PAY2-21 ${step} confirmed import → flagged paid_late_no_import`, r.cancelReason === LATE_UNATTACHED && r.needsAttention === true);
  }
  // 2 definitive not paid → expired, 410
  { const st: St = { down: false, confirmed: false, calls: 0, applies: 0 }; const svc: any = new ImportCommerceService(prisma, atmos(st)); const u = await mkUser(); const p = await mkPay(u.id);
    const e = await svc.apply(u.id, p.id, '1').catch((x: any) => x); const r = await get(p.id);
    check('PAY2-21 definitive no → expired + session_expired', r.status === S.expired && code(e) === 'session_expired' && st.applies === 0, code(e)); }
  // 3 Atmos down → stays pending, needsAttention, 409 payment_under_review; then sweeper reconciles
  { const st: St = { down: true, confirmed: true, calls: 0, applies: 0 }; const svc: any = new ImportCommerceService(prisma, atmos(st)); const u = await mkUser(); const p = await mkPay(u.id, 'plus_pass:30');
    const e = await svc.apply(u.id, p.id, '1').catch((x: any) => x); let r = await get(p.id);
    check('PAY2-21 Atmos down → pending + needsAttention + payment_under_review, no charge attempt', r.status === S.pending && r.needsAttention && code(e) === 'payment_under_review' && st.applies === 0, code(e));
    st.down = false; await svc.expireStalePending(); r = await get(p.id);
    const ents = await prisma.entitlement.count({ where: { importPaymentId: p.id, kind: 'plus', status: 'active' } });
    check('PAY2-21 then sweeper: Atmos confirmed → paid + 1 Plus pass', r.status === S.paid && ents === 1, `ents=${ents}`);
    check('PAY2-21 review flag cleared after the late Plus grant', r.needsAttention === false, `needsAttention=${r.needsAttention}`); }
  // 4 Atmos down then definitive no via sweeper → expired; flag?
  { const st: St = { down: true, confirmed: false, calls: 0, applies: 0 }; const svc: any = new ImportCommerceService(prisma, atmos(st)); const u = await mkUser(); const p = await mkPay(u.id);
    await svc.preApply(u.id, p.id, '8600000000000000', '2912').catch(() => 0); st.down = false; await svc.expireStalePending(); const r = await get(p.id);
    check('PAY2-21 under-review then definitive no → expired, flag cleared', r.status === S.expired && r.needsAttention === false, `status=${r.status} needsAttention=${r.needsAttention}`); }
  // 5 unclear answer (no store_transaction) → under review
  { const st: St = { down: false, confirmed: false, noStore: true, calls: 0, applies: 0 }; const svc: any = new ImportCommerceService(prisma, atmos(st)); const u = await mkUser(); const p = await mkPay(u.id);
    const e = await svc.retryOtp(u.id, p.id).catch((x: any) => x); const r = await get(p.id);
    check('PAY2-21 unclear answer → pending + payment_under_review', r.status === S.pending && code(e) === 'payment_under_review'); }
  // 6 idempotency: 8 parallel retries + 3 callbacks + sweeper on a confirmed Plus payment
  { const st: St = { down: false, confirmed: true, calls: 0, applies: 0 }; const svc: any = new ImportCommerceService(prisma, atmos(st)); const u = await mkUser(); const p = await mkPay(u.id, 'plus_pass:30');
    const o: any = { store_id: 999, transaction_id: p.providerPaymentId, invoice: p.account, amount: p.amountTiyins }; o.sign = sign(o);
    const hook = svc.handleAtmosCallback ?? svc.handleCallback ?? svc.atmosCallback;
    await Promise.allSettled([...Array(8)].map((_, i) => i % 2 ? svc.apply(u.id, p.id, '1') : svc.retryOtp(u.id, p.id)).concat(hook ? [1, 2, 3].map(() => hook.call(svc, { ...o })) : []).concat([svc.expireStalePending()]));
    const ents = await prisma.entitlement.findMany({ where: { importPaymentId: p.id, kind: 'plus' } }); const r = await get(p.id);
    check('PAY2-21 race: 8 retries + callbacks + sweeper → paid, exactly 1 pass, 0 charges', r.status === S.paid && ents.length === 1 && st.applies === 0, `ents=${ents.length} hook=${!!hook}`); }
  // 7 near expiry: 30 s left → normal apply goes to Atmos (no premature expiry)
  { const st: St = { down: false, confirmed: false, calls: 0, applies: 0 }; const svc: any = new ImportCommerceService(prisma, atmos(st)); const u = await mkUser(); const p = await mkPay(u.id, 'article', -0.5);
    await svc.apply(u.id, p.id, '1').catch(() => 0); const r = await get(p.id);
    check('near expiry (30 s left): apply reaches Atmos and is paid', st.applies === 1 && r.status === S.paid, `status=${r.status}`); }
  console.log(fails ? `qa3-pay2-21: ${fails} FAILED` : 'qa3-pay2-21: all passed'); await prisma.$disconnect(); process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
