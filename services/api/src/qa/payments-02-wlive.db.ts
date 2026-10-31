/* PAY2-08 / PAY2-09 / PAY2-12 DB-backed checks against a THROWAWAY local Postgres (QA_DB). Mocked Atmos + OpenAI; network forbidden.
 * Run: QA_DB=postgresql://…/qa_x AGE_UNKNOWN_BAND=adult npx ts-node --transpile-only src/qa/payments-02-wlive.db.ts */
process.env.ATMOS_API_KEY = 'qa-dummy-not-a-key'; process.env.ATMOS_STORE_ID = '999';
process.env.ATMOS_SANDBOX = 'true'; process.env.PAYMENT_GATEWAY_ENABLED = 'true'; process.env.NODE_ENV = 'test';
process.env.AGE_UNKNOWN_BAND = 'adult'; delete process.env.OPENAI_API_KEY;
(globalThis as any).fetch = async () => { throw new Error('NETWORK FORBIDDEN'); };
import { createHash, randomUUID } from 'crypto';
import { PrismaClient, ImportPaymentStatus as S } from '@prisma/client';
import { ImportCommerceService, LATE_UNATTACHED, LATE_UNATTACHED_REFUND_MS } from '../modules/billing/import-commerce.service';
import { AtmosClient } from '../modules/billing/atmos.client';
import { AiService } from '../modules/ai/ai.service';
import { resetPlanCapsCache, usageDayStart } from '../common/plan-caps';

if (!process.env.QA_DB || !/127\.0\.0\.1:\d+\/qa_/.test(process.env.QA_DB) || /prod|staging/i.test(process.env.QA_DB)) throw new Error('QA_DB must be a local throwaway qa_* DB');
const prisma: any = new PrismaClient({ datasources: { db: { url: process.env.QA_DB } } }); prisma.dbAvailable = true;
let fails = 0;
const check = (n: string, ok: boolean, info = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${info}`); };
type St = { down: boolean; confirmed: boolean; reverses: number };
function atmos(state: St) {
  const m: any = Object.create(new AtmosClient());
  m.configured = () => true; m.mode = () => 'test';
  m.getTransaction = async (id: number) => { if (state.down) throw new Error('atmos down'); return { transactionId: id, confirmed: state.confirmed, raw: { store_transaction: { confirmed: state.confirmed } } }; };
  m.reverseTransaction = async (p: any) => { state.reverses++; return { transactionId: p.transactionId, raw: {} }; };
  return m as AtmosClient;
}
const sign = (o: any) => createHash('md5').update(`${o.store_id}${o.transaction_id}${o.invoice}${o.amount}qa-dummy-not-a-key`).digest('hex');
const cb = (p: any) => { const o: any = { store_id: 999, transaction_id: p.providerPaymentId, invoice: p.account, amount: p.amountTiyins }; o.sign = sign(o); return o; };
const mkUser = () => prisma.user.create({ data: { email: `wl+${randomUUID()}@test.local`, nativeLanguage: 'uz' as any } });
const mkPay = (userId: string, fmt = 'article', minsAgo = 61, extra: Record<string, unknown> = {}) => prisma.importPayment.create({ data: { userId, account: `wl_${randomUUID().slice(0, 12)}`, amountTiyins: 1200000, currency: 'UZS', estimatedPages: fmt.startsWith('plus') ? 0 : 5, contentFormat: fmt, importType: 'paste' as any, status: S.pending, provider: 'atmos', providerPaymentId: String(1e6 + Math.floor(Math.random() * 1e9)), expiresAt: new Date(Date.now() - minsAgo * 60_000), ...extra } });
const get = (id: string) => prisma.importPayment.findUniqueOrThrow({ where: { id } });
function ai(onCall = () => undefined as void) {
  const s: any = new AiService(prisma as any);
  s.getClient = () => ({
    chat: { completions: { create: async () => { onCall(); await new Promise((r) => setTimeout(r, 20)); return { choices: [{ message: { content: JSON.stringify({ lemma: 'x', translation: 'y', contextualMeaning: 'z' }) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }; } } },
  });
  return s;
}
const word = (i: number) => ({ token: `w${i}${randomUUID().slice(0, 6)}`, sentence: `Sentence ${i} ${randomUUID()}.`, sourceLang: 'en', targetLang: 'uz' });

async function main() {
  await prisma.subscriptionPlan.deleteMany({});
  await prisma.subscriptionPlan.createMany({ data: [{ tier: 'free', name: 'Free', aiDailyQuota: 20, importLimit: 3, quizDailyQuota: 10 }, { tier: 'premium', name: 'Plus', aiDailyQuota: 1000000, importLimit: 3, quizDailyQuota: 200 }] });
  // ---- PAY2-08: late success (callback on expired) with no import → free retry + flagged
  { const st: St = { down: true, confirmed: true, reverses: 0 }; const svc = new ImportCommerceService(prisma as any, atmos(st));
    const u = await mkUser(); const p = await mkPay(u.id);
    await svc.expireStalePending(new Date(Date.now() + 25 * 3_600_000)); // 24 h cap → expired unverified
    check('PAY2-08 setup: expired unverified', (await get(p.id)).status === S.expired);
    await svc.handleAtmosCallback(cb(p)); const f = await get(p.id);
    const rs = await svc.importRetryState(u.id);
    const entry = rs.freeRetries.find((r: any) => r.paymentId === p.id) as any;
    check('PAY2-08 late callback, no import → paid + needsAttention + LATE_UNATTACHED', f.status === S.paid && f.needsAttention && f.cancelReason === LATE_UNATTACHED, JSON.stringify({ s: f.status, n: f.needsAttention, r: f.cancelReason }));
    check('PAY2-08 user-visible: offered as free retry (reason paid_late)', entry?.reason === 'paid_late' && entry.importType === 'paste');
    const used = await svc.consumePayment(u.id, p.id, 'paste' as any);
    check('PAY2-08 retry consumes the SAME payment (no new charge)', used?.id === p.id);
    const imp = await prisma.userImport.create({ data: { userId: u.id, importType: 'paste' as any, title: 't', ingestionStatus: 'ready' as any } as any }).catch((e: any) => { console.log(String(e).slice(-300)); return null; });
    if (imp) { await svc.attachUserImport(p.id, imp.id); const g = await get(p.id);
      check('PAY2-08 delivered after retry → review flag cleared', !g.needsAttention && g.cancelReason === null && g.userImportId === imp.id);
      check('PAY2-08 delivered → no longer in retry list', !(await svc.importRetryState(u.id)).freeRetries.some((r) => r.paymentId === p.id)); }
    else check('PAY2-08 userImport fixture', false, 'could not create user_import'); }
  // ---- PAY2-08: reconcile path (Atmos confirms at expiry) with no import → flagged; Plus is NOT flagged
  { const st: St = { down: false, confirmed: true, reverses: 0 }; const svc = new ImportCommerceService(prisma as any, atmos(st));
    const u = await mkUser(); const p = await mkPay(u.id); const plus = await mkPay(u.id, 'plus_pass:30');
    await svc.expireStalePending(); const f = await get(p.id); const fp = await get(plus.id);
    check('PAY2-08 reconcile-at-expiry import → paid + flagged + retry offered', f.status === S.paid && f.needsAttention && (await svc.importRetryState(u.id)).freeRetries.some((r) => r.paymentId === p.id));
    check('PAY2-08 reconcile-at-expiry Plus → paid, granted, not flagged', fp.status === S.paid && !fp.needsAttention);
    // unused for 7 days → refund-due (admin review)
    await svc.settleFailedImports(200, new Date(Date.now() + LATE_UNATTACHED_REFUND_MS + 60_000)); const r = await get(p.id);
    const rs = await svc.importRetryState(u.id);
    check('PAY2-08 unused 7 d → refundDue + needsAttention, shown as refund-due', r.refundDue && r.needsAttention && rs.refundDue >= 1 && !rs.freeRetries.some((x) => x.paymentId === p.id)); }
  // ---- PAY2-08: normal on-time paid import is NOT flagged
  { const svc = new ImportCommerceService(prisma as any, atmos({ down: false, confirmed: true, reverses: 0 }));
    const u = await mkUser(); const p = await mkPay(u.id, 'article', -30);
    await svc.handleAtmosCallback(cb(p)); const f = await get(p.id);
    check('PAY2-08 on-time paid import untouched', f.status === S.paid && !f.needsAttention && f.cancelReason == null); }

  // ---- PAY2-09: 45 parallel Free lookups → exactly 20 served (burst limits not hit by design: raise them)
  { resetPlanCapsCache(); const u = await mkUser(); let calls = 0;
    const s = ai(() => { calls++; }); s.burstGuard = async () => undefined;
    const rs = await Promise.allSettled(Array.from({ length: 45 }, (_, i) => s.lookup(u.id, word(i))));
    const ok = rs.filter((r) => r.status === 'fulfilled').length;
    const codes = rs.filter((r) => r.status === 'rejected').map((r: any) => r.reason?.getResponse?.()?.code ?? String(r.reason));
    const row = await prisma.aiUsageDaily.findUnique({ where: { userId_usageDate: { userId: u.id, usageDate: usageDayStart() } } });
    check('PAY2-09 45 parallel Free lookups → exactly 20 served, 25×429, counter 20, OpenAI ≤ 20', ok === 20 && codes.length === 25 && codes.every((c) => c === 'lookup_limit') && row?.lookupCount === 20 && calls <= 20, `ok=${ok} count=${row?.lookupCount} calls=${calls} codes=${[...new Set(codes)]}`); }
  // ---- PAY2-09: OpenAI failure releases the slot
  { resetPlanCapsCache(); const u = await mkUser(); const s = ai(); s.burstGuard = async () => undefined;
    s.getClient = () => ({ chat: { completions: { create: async () => { throw new Error('openai down'); } } } });
    await s.lookup(u.id, word(1)).catch(() => undefined);
    const row = await prisma.aiUsageDaily.findUnique({ where: { userId_usageDate: { userId: u.id, usageDate: usageDayStart() } } });
    check('PAY2-09 failed OpenAI call does not burn a lookup', (row?.lookupCount ?? 0) === 0, `count=${row?.lookupCount}`); }
  // ---- PAY2-09: burst guard is shared across processes (two AiService instances = two API processes)
  { const a = ai(), b = ai(); const u = randomUUID(); const t0 = Date.now(); let ok = 0; const codes: string[] = [];
    const rs = await Promise.allSettled(Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).burstGuard(u, t0 + i)));
    for (const r of rs) if (r.status === 'fulfilled') ok++; else codes.push((r as any).reason?.getResponse?.()?.code);
    check('PAY2-09 burst 30/min across 2 instances, 40 parallel → exactly 30 pass, 10 lookup_slow_down', ok === 30 && codes.length === 10 && codes.every((c) => c === 'lookup_slow_down'), `ok=${ok}`);
    await a.burstGuard(u, t0 + 61_000).then(() => check('PAY2-09 window slides after 60 s (no ban)', true), () => check('PAY2-09 window slides after 60 s (no ban)', false));
    const h = randomUUID(); let okH = 0;
    for (let i = 0; i < 305; i++) await (i % 2 ? a : b).burstGuard(h, t0 + i * 10_000).then(() => okH++, () => undefined);
    check('PAY2-09 300/h ceiling across instances', okH === 300, `ok=${okH}`); }

  // ---- PAY2-12: backoff persisted in next_check_at (survives a new process), oldest first, flag cleared on late grant
  { const st: St = { down: true, confirmed: true, reverses: 0 }; const u = await mkUser();
    const p = await mkPay(u.id, 'plus_pass:30');
    const r1 = await new ImportCommerceService(prisma as any, atmos(st)).expireStalePending();
    const a = await get(p.id);
    check('PAY2-12 Atmos down → next_check_at persisted, attempts 1', a.status === S.pending && !!a.nextCheckAt && a.nextCheckAt > new Date() && a.expiryCheckAttempts === 1, JSON.stringify(r1));
    const fresh = new ImportCommerceService(prisma as any, atmos(st)); // "restarted" process: no in-memory state
    let calls = 0; const at: any = (fresh as any).atmos; const orig = at.getTransaction; at.getTransaction = async (id: number) => { calls++; return orig(id); };
    await fresh.expireStalePending();
    check('PAY2-12 new process honours the persisted backoff (no Atmos call)', calls === 0 && (await get(p.id)).expiryCheckAttempts === 1, `calls=${calls}`);
    await fresh.expireStalePending(new Date(Date.now() + 11 * 60_000));
    const b = await get(p.id);
    check('PAY2-12 after next_check_at → re-checked, attempts 2, backoff doubled', b.expiryCheckAttempts === 2 && b.nextCheckAt!.getTime() - (Date.now() + 11 * 60_000) > 15 * 60_000, `next=${b.nextCheckAt?.toISOString()}`);
    await fresh.expireStalePending(new Date(Date.now() + 25 * 3_600_000)); const c = await get(p.id);
    check('PAY2-12 24 h cap → expired + manual review', c.status === S.expired && c.needsAttention && (c.cancelReason ?? '').startsWith('expired_unverified'));
    await fresh.handleAtmosCallback(cb(p)); const d = await get(p.id);
    const ents = await prisma.entitlement.count({ where: { importPaymentId: p.id, kind: 'plus', status: 'active' } });
    check('PAY2-12 late grant clears the manual-review flag (Plus granted once)', d.status === S.paid && !d.needsAttention && d.cancelReason == null && ents === 1, JSON.stringify({ n: d.needsAttention, r: d.cancelReason, ents })); }
  { const st: St = { down: false, confirmed: false, reverses: 0 }; const u = await mkUser();
    await prisma.importPayment.updateMany({ where: { status: S.pending }, data: { status: S.failed } });
    const newer = await mkPay(u.id, 'article', 61); const older = await mkPay(u.id, 'article', 600); const mid = await mkPay(u.id, 'article', 120);
    const seen: string[] = []; const m: any = atmos(st); const g = m.getTransaction; m.getTransaction = async (id: number) => { seen.push(String(id)); return g(id); };
    await new ImportCommerceService(prisma as any, m).expireStalePending(new Date(), 2);
    check('PAY2-12 expiry batch is oldest first (limit 2 → the two oldest)', seen.join() === [older, mid].map((x) => x.providerPaymentId).join() && (await get(newer.id)).status === S.pending, seen.join()); }

  await prisma.$disconnect();
  console.log(fails ? `FAILED ${fails}` : 'payments-02-wlive.db: all passed');
  process.exit(fails ? 1 : 0);
}
main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
