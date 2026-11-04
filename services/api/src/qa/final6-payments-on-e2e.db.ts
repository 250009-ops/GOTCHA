/* final-6: payments ON end to end against a mocked Atmos (throwaway qa_* DB, network forbidden).
 * Flag = PAYMENT_GATEWAY_ENABLED=true only (+ WEB_PLUS_PASS=true for Plus on the web). Plus 30 / 365 and every import
 * page tier: pay/create → pre-apply → OTP apply → paid → access (Plus entitlement + Plus import pool; import credit
 * consumable once). Also: gateway-status ON, pay/create limit, no PAYMENTS_UI_ENABLED needed. */
process.env.ATMOS_API_KEY = 'qa-dummy-not-a-key'; process.env.ATMOS_STORE_ID = '999';
process.env.ATMOS_SANDBOX = 'true'; process.env.PAYMENT_GATEWAY_ENABLED = 'true'; process.env.WEB_PLUS_PASS = 'true'; process.env.NODE_ENV = 'test';
delete process.env.PAYMENTS_UI_ENABLED; delete process.env.IMPORTS_UNLIMITED; delete process.env.DEV_UNLIMITED_IMPORTS;
process.env.AGE_UNKNOWN_BAND = 'adult'; delete process.env.OPENAI_API_KEY;
(globalThis as any).fetch = async () => { throw new Error('NETWORK FORBIDDEN'); };
import { randomUUID } from 'crypto';
import { PrismaClient, ImportPaymentStatus as S } from '@prisma/client';
import { ImportCommerceService } from '../modules/billing/import-commerce.service';
import { AtmosClient } from '../modules/billing/atmos.client';
import { paymentsUiEnabled } from '../common/payments-ui';
if (!/127\.0\.0\.1:\d+\/qa_/.test(process.env.QA_DB ?? '')) throw new Error('QA_DB must be local qa_*');
const prisma: any = new PrismaClient({ datasources: { db: { url: process.env.QA_DB } } }); prisma.dbAvailable = true;
let fails = 0; const check = (n: string, ok: boolean, i = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i}`); };
let txSeq = 700000 + Math.floor(Math.random() * 100000);
const calls: string[] = [];
function atmos() {
  const m: any = Object.create(new AtmosClient()); const txs = new Map<number, { amount: number; account: string; confirmed: boolean }>();
  m.configured = () => true; m.mode = () => 'test'; m.minAmountTiyins = () => 100_000;
  m.createTransaction = async ({ amountTiyins, account }: any) => { calls.push('create'); const id = ++txSeq; txs.set(id, { amount: amountTiyins, account, confirmed: false }); return { transactionId: id, storeTransactionId: id, amount: amountTiyins, account, raw: {} }; };
  m.preApplyTransaction = async ({ transactionId }: any) => { calls.push('preApply'); return { transactionId, maskedPhone: '+998 ** *** 12 34', raw: {} }; };
  m.preApplyWithToken = m.preApplyTransaction;
  m.applyTransaction = async ({ transactionId, otp }: any) => { calls.push('apply'); const t = txs.get(transactionId)!; t.confirmed = otp === '111111';
    return { transactionId, successTransId: transactionId, confirmed: t.confirmed, ofdUrl: t.confirmed ? `https://ofd.test/${transactionId}` : undefined, raw: { store_transaction: { confirmed: t.confirmed } } }; };
  m.getTransaction = async (id: number) => { const t = txs.get(id); return t ? { transactionId: id, confirmed: t.confirmed, raw: { store_transaction: { confirmed: t.confirmed } } } : null; };
  m.retryOtp = async (id: number) => ({ transactionId: id, raw: {} }); m.resendOtp = m.retryOtp; m.reverseTransaction = async () => ({ raw: {} });
  return m as AtmosClient;
}
const mkUser = () => prisma.user.create({ data: { email: `f6+${randomUUID()}@test.local`, nativeLanguage: 'uz' as any, birthYear: 1990 } as any });
const code = (e: any) => e?.response?.code ?? e?.getResponse?.()?.code ?? String(e?.message);
async function pay(svc: any, userId: string, paymentId: string) {
  const pre = await svc.preApply(userId, paymentId, '8600123412341234', '2912');
  const res = await svc.apply(userId, paymentId, '111111');
  return { pre, res, row: await prisma.importPayment.findUniqueOrThrow({ where: { id: paymentId } }) };
}
async function main() {
  check('flag: PAYMENT_GATEWAY_ENABLED=true alone turns payments ON', paymentsUiEnabled() === true);
  const svc: any = new ImportCommerceService(prisma, atmos());
  check('gateway-status ON', svc.gatewayEnabled() === true);
  // Plus 30 / 365
  for (const days of [30, 365]) {
    const u = await mkUser(); calls.length = 0;
    const offer = await svc.plusOffer(u.id);
    check(`Plus ${days}: offered`, offer.enabled === true && offer.plans.some((p: any) => p.days === days), JSON.stringify(offer.plans));
    const noTick = await svc.plusCheckout(u.id, days, undefined).catch((e: any) => e);
    check(`Plus ${days}: refused without the consent tick-box`, code(noTick) === 'oferta_required');
    const co = await svc.plusCheckout(u.id, days, true);
    const { res, row } = await pay(svc, u.id, co.paymentId);
    const ent = await prisma.entitlement.findFirst({ where: { userId: u.id, kind: 'plus', status: 'active' } });
    const span = ent?.expiresAt ? Math.round((+ent.expiresAt - Date.now()) / 86_400_000) : -1;
    check(`Plus ${days}: create → pre-apply → OTP → paid`, row.status === S.paid && res.step === 'paid' && calls.join(',') === 'create,preApply,apply', `${row.status} ${calls}`);
    check(`Plus ${days}: consent recorded`, !!row.ofertaAcceptedAt && !!row.ofertaVersion);
    check(`Plus ${days}: active pass for ${days} days`, Math.abs(span - days) <= 1, `span=${span}`);
    check(`Plus ${days}: Plus import pool applies`, (await svc.learnerAllowance(u.id)).tier === 'plus');
    // idempotent: a second apply/callback-equivalent never grants twice
    await svc.apply(u.id, co.paymentId, '111111').catch(() => 0);
    check(`Plus ${days}: exactly one entitlement`, (await prisma.entitlement.count({ where: { importPaymentId: co.paymentId } })) === 1);
  }
  // Import tiers
  await prisma.importPageTier.deleteMany({});
  const tiers = [{ label: '1–50', minPages: 1, maxPages: 50, priceUsd: 12000 }, { label: '51–300', minPages: 51, maxPages: 300, priceUsd: 29000 }, { label: '301+', minPages: 301, maxPages: null, priceUsd: 49000 }];
  for (const [i, t] of tiers.entries()) await prisma.importPageTier.create({ data: { ...t, sortOrder: i, active: true } });
  for (const [t, pages] of [[tiers[0], 40], [tiers[1], 120], [tiers[2], 500]] as const) {
    const u = await mkUser(); calls.length = 0;
    const input = { importType: 'pdf', pageCount: pages } as any;
    const q = await svc.quote(u.id, input);
    check(`tier ${t.label}: quote ${pages} p = ${t.priceUsd} soʻm`, q.requiresPayment === true && q.amountTiyins === t.priceUsd * 100, `req=${q.requiresPayment} amt=${q.amountTiyins} ${q.freeReason}`);
    const co = await svc.checkout(u.id, input);
    const { row } = await pay(svc, u.id, co.paymentId);
    check(`tier ${t.label}: paid`, row.status === S.paid && row.amountTiyins === t.priceUsd * 100);
    const credit = await svc.consumePayment(u.id, co.paymentId, 'pdf', pages);
    check(`tier ${t.label}: import access granted`, credit?.id === co.paymentId);
    const ui = await prisma.userImport.create({ data: { userId: u.id, title: 'e2e', importType: 'pdf' } as any });
    { await svc.attachUserImport(co.paymentId, ui.id); const again = await svc.consumePayment(u.id, co.paymentId, 'pdf', pages).catch((e: any) => e);
      check(`tier ${t.label}: credit consumable once`, /already used/.test(String(again?.message))); }
  }
  // pay/create limit (5/min) holds with payments ON
  { const u = await mkUser(); let last: any = null;
    for (let i = 0; i < 6; i++) last = await svc.checkout(u.id, { importType: 'pdf', pageCount: 40 + i * 2 } as any).catch((e: any) => e);
    check('pay/create: 6th new payment in a minute → 429 payment_rate_limited', code(last) === 'payment_rate_limited', code(last)); }
  console.log(fails ? `FAILED ${fails}` : 'final6-payments-on-e2e: ALL PASS');
  await prisma.$disconnect(); process.exit(fails ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
