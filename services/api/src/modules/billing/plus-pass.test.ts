import * as assert from 'node:assert/strict';
import { ImportCommerceService } from './import-commerce.service';
import { projectPlus } from './entitlements.service';
import { MAX_TOTAL_DISCOUNT_PCT, PLUS_DEFAULT_IMPORT_DISCOUNT_PCT, capTotalDiscountTiyins, PLUS_DEFAULT_PRICES, adminGrantEnd, dueReminder, laterEnd, plusDiscountTiyins, plusPassConfig, plusPassExpiry } from './plus-pass';
import { activeSubWhere, fairUseCap, PLUS_FAIR_USE_DEFAULTS } from '../../common/plan-active';
import * as planActive from '../../common/plan-active';
import { promoDiscountTiyins } from './pricing.service';
import { OFERTA_URL, REFUND_RULE_EN, SELLER, redactAtmosRaw, shiftStackedPlusAfterRefund } from './import-commerce.service';
import { atmosLogSummary } from './atmos.client';

const D = 86_400_000;
const now = new Date('2026-11-01T07:00:00Z');

async function main() {
  // Config: relayed option C defaults, admin > env > default, flag off by default.
  const def = plusPassConfig({}, 500);
  assert.equal(def.enabled, false);
  assert.deepEqual(def.plans.map((p) => [p.days, p.priceUzs]), [[30, 24990], [365, 199990]]);
  assert.deepEqual(PLUS_DEFAULT_PRICES, { 30: 24990, 365: 199990 });
  const env = plusPassConfig({ WEB_PLUS_PASS: 'true', PLUS_PASS_30_PRICE_UZS: '30000' }, 500, { 'plus.pass.price_30_uzs': 27000 });
  assert.equal(env.enabled, true);
  assert.equal(env.plans[0].priceUzs, 27000);
  assert.deepEqual(env.reminderDays, [3, 1, 0]);

  // Stacking: max(now, current) + days.
  assert.equal(plusPassExpiry(null, 30, now).getTime(), now.getTime() + 30 * D);
  const cur = new Date(now.getTime() + 10 * D);
  assert.equal(plusPassExpiry(cur, 365, now).getTime(), cur.getTime() + 365 * D);
  assert.equal(plusPassExpiry(new Date(now.getTime() - D), 30, now).getTime(), now.getTime() + 30 * D);

  // Discount never below the Atmos minimum.
  assert.equal(plusDiscountTiyins(1_000_000, 20, 50_000), 200_000);
  assert.equal(plusDiscountTiyins(60_000, 50, 50_000), 10_000);
  assert.equal(plusDiscountTiyins(100_000, 0, 50_000), 0);

  // Reminders 3 / 1 / on the day (Asia/Tashkent).
  assert.equal(dueReminder(new Date(now.getTime() + 2.5 * D), [3, 1, 0], now), 3);
  assert.equal(dueReminder(new Date(now.getTime() + 0.9 * D), [3, 1, 0], now), 1);
  assert.equal(dueReminder(new Date('2026-11-01T15:00:00Z'), [3, 1, 0], now), 0);
  assert.equal(dueReminder(new Date(now.getTime() + 5 * D), [3, 1, 0], now), null);
  assert.equal(dueReminder(new Date(now.getTime() - 1), [3, 1, 0], now), null);

  // Overlap: later end wins; admin grants 7/30/365/custom.
  assert.equal(laterEnd(new Date(1), new Date(2))!.getTime(), 2);
  assert.equal(laterEnd(null, new Date(2)), null);
  assert.equal(adminGrantEnd({ days: 365 }, now).getTime(), now.getTime() + 365 * D);
  assert.equal(adminGrantEnd({ days: 7 }, now).getTime(), now.getTime() + 7 * D);
  assert.throws(() => adminGrantEnd({ days: 12 }, now));
  assert.throws(() => adminGrantEnd({ until: '2020-01-01' }, now));
  assert.equal(adminGrantEnd({ until: '2026-12-31T00:00:00Z' }, now).toISOString(), '2026-12-31T00:00:00.000Z');

  // Expiry enforced in subscription checks; fair-use defaults.
  assert.deepEqual(activeSubWhere(now).OR, [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }]);
  assert.equal(fairUseCap(undefined, 500), 500);
  assert.equal(fairUseCap(800, 500), 800);
  // No Plus lookup limit-hit / fair-use copy is exported any more (PAYMENTS §14/§16).
  assert.ok(!('FAIR_USE_MESSAGE' in planActive) && !('dailyLimitError' in planActive) && !('fairUseLimitMessage' in planActive));

  // Fulfilment: idempotent on Atmos transaction id; stacks; projects to user_subscriptions.
  const ents: any[] = [];
  const subs: any[] = [];
  const prisma: any = {
    entitlement: {
      findFirst: async ({ where }: any) => ents.find((e) => where.OR
        ? where.OR.some((o: any) => (o.sourceRef && e.sourceRef === o.sourceRef && e.source === o.source) || (o.importPaymentId && e.importPaymentId === o.importPaymentId))
        : e.userId === where.userId && e.kind === 'plus' && e.status === 'active' && e.expiresAt > new Date()) ?? null,
      findMany: async ({ where }: any) => ents.filter((e) => e.userId === where.userId && e.status === 'active' && where.source.in.includes(e.source) && (!e.expiresAt || e.expiresAt > new Date())),
      create: async ({ data }: any) => { ents.push(data); return data; },
    },
    subscriptionPlan: { findUnique: async () => ({ id: 'premium' }) },
    userSubscription: {
      findFirst: async () => subs[subs.length - 1] ?? null,
      create: async ({ data }: any) => { subs.push(data); return data; },
      update: async ({ data }: any) => Object.assign(subs[subs.length - 1], data),
    },
    platformSetting: { findMany: async () => [] },
  };
  // PAY1-03: $transaction + pg_advisory_xact_lock fake: transactions that took the per-user lock run one at a time.
  const lockKeys: string[] = [];
  let chain: Promise<unknown> = Promise.resolve();
  prisma.$executeRaw = async (_q: TemplateStringsArray, key: string) => { lockKeys.push(key); return 1; };
  prisma.$transaction = (fn: any) => { const run = chain.then(() => fn(prisma)); chain = run.catch(() => undefined); return run; };
  const atmos: any = { minAmountTiyins: () => 50_000, configured: () => true, mode: () => 'test', createTransaction: async () => { throw new Error('no live Atmos in tests'); } };
  const svc = new ImportCommerceService(prisma, atmos);
  const pay = { id: 'p1', userId: 'u1', status: 'paid' as any, contentFormat: 'plus_pass:30', providerPaymentId: '777' };
  await svc.fulfillPlusPass(pay);
  await svc.fulfillPlusPass(pay); // webhook + apply race
  await svc.fulfillPlusPass({ ...pay, id: 'p1-dup' }); // same Atmos tx id, different row
  assert.equal(ents.length, 1, 'one pass per Atmos transaction');
  assert.equal(ents[0].sourceRef, '777');
  assert.equal(subs[0].status, 'active');
  assert.equal(subs[0].provider, 'atmos');
  const firstEnd = ents[0].expiresAt.getTime();
  await svc.fulfillPlusPass({ id: 'p2', userId: 'u1', status: 'paid' as any, contentFormat: 'plus_pass:365', providerPaymentId: '778' });
  assert.equal(ents.length, 2);
  assert.ok(Math.abs(ents[1].expiresAt.getTime() - (firstEnd + 365 * D)) < 1000, 'second pass stacks on the first');
  assert.equal(subs[0].currentPeriodEnd.getTime(), ents[1].expiresAt.getTime(), 'later end wins');
  // PAY1-03: two Plus payments landing at the same time (user u9): both stack, no lost days, lock taken per user.
  {
    const t0 = Date.now();
    await Promise.all([
      svc.fulfillPlusPass({ id: 'c1', userId: 'u9', status: 'paid' as any, contentFormat: 'plus_pass:30', providerPaymentId: '901' }),
      svc.fulfillPlusPass({ id: 'c2', userId: 'u9', status: 'paid' as any, contentFormat: 'plus_pass:30', providerPaymentId: '902' }),
    ]);
    const mine = ents.filter((e) => e.userId === 'u9').map((e) => e.expiresAt.getTime()).sort((a, b) => a - b);
    assert.equal(mine.length, 2);
    assert.ok(Math.abs(mine[1] - (t0 + 60 * D)) < 5000, 'concurrent 30 + 30 = 60 days, not 30');
    assert.ok(lockKeys.includes('plus:u9'), 'per-user advisory lock');
  }

  // Play overlap: a Play sub ending later wins the projection.
  ents.push({ userId: 'u1', kind: 'plus', source: 'google_play', sourceRef: 'tok', status: 'active', expiresAt: new Date(Date.now() + 1000 * D) });
  await projectPlus(prisma, 'u1');
  assert.equal(subs[0].provider, 'google_play');

  // Refund ends the pass immediately.
  ents.forEach((e) => { e.status = 'revoked'; e.expiresAt = new Date(); });
  await projectPlus(prisma, 'u1');
  assert.equal(subs[0].status, 'canceled');

  // Checkout is off by default and never calls Atmos then.
  delete process.env.WEB_PLUS_PASS;
  await assert.rejects(() => svc.plusCheckout('u1', 30), /not sold on the web/);

  // 13:57 decisions: Plus import discount 50% (admin-editable via plus.benefits), combined Plus+promo capped at 70%.
  assert.equal(PLUS_DEFAULT_IMPORT_DISCOUNT_PCT, 50);
  assert.equal(plusPassConfig({}, 500, {}).benefits.importDiscountPct, 50);
  assert.equal(plusPassConfig({}, 500, { 'plus.benefits': { importDiscountPct: 20 } }).benefits.importDiscountPct, 20);
  assert.equal(plusPassConfig({}, 500, {}).benefits.freeImportMaxPages, 0);
  assert.equal(plusPassConfig({}, 500, {}).benefits.bookDiscountPct, 0);
  {
    const list = 100_000_00, min = 500_00;
    const plus = plusDiscountTiyins(list, 50, min); // 50%
    const promo = promoDiscountTiyins(list - plus, { percentOff: 70, amountOffUzs: null } as never, min); // 70% of the rest
    assert.equal(plus + promo, 85_000_00, 'uncapped would be 85%');
    assert.equal(MAX_TOTAL_DISCOUNT_PCT, 70);
    assert.equal(capTotalDiscountTiyins(list, plus + promo, min), 70_000_00, '50% + 70% promo => 70%, not 85%');
    assert.equal(capTotalDiscountTiyins(list, 25_000_00 + 52_500_00, min), 70_000_00, '25% + 70% promo => 70%, not 77.5%');
    assert.equal(capTotalDiscountTiyins(60_000, 59_000, min), 10_000, 'Atmos minimum (500 soʻm) still wins over the 70% cap');
  }
  // Legacy key default (not read for Plus lookups; Plus has no daily lookup limit).
  assert.equal(PLUS_FAIR_USE_DEFAULTS.lookups, 200);
  // Seller = team only; no legal name / STIR; oferta URL still a placeholder (null).
  assert.deepEqual(SELLER, { en: 'the Erkin Tizim team', uz: 'Erkin Tizim jamoasi', ru: 'команда Erkin Tizim' });
  assert.equal(OFERTA_URL, null);
  assert.match(REFUND_RULE_EN, /within 14 days of payment; approved refunds are returned within 10 working days\.$/);

  // PAY1-02: refunding a stacked pass moves later passes back by its unused days.
  {
    const now = new Date('2026-11-01T00:00:00Z');
    const day = (n: number) => new Date(now.getTime() + n * D);
    const rows: any[] = [
      { id: 'a', userId: 'u', kind: 'plus', status: 'active', importPaymentId: 'pa', startsAt: day(-10), expiresAt: day(20) }, // running 30
      { id: 'b', userId: 'u', kind: 'plus', status: 'active', importPaymentId: 'pb', startsAt: day(20), expiresAt: day(385) }, // stacked 365
    ];
    const tx: any = {
      entitlement: {
        findFirst: async ({ where }: any) => rows.find((r) => r.importPaymentId === where.importPaymentId && r.status === 'active') ?? null,
        findMany: async ({ where }: any) => rows.filter((r) => r.userId === where.userId && r.status === 'active' && r.startsAt >= where.startsAt.gte),
        update: async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id), data),
      },
    };
    assert.equal(await shiftStackedPlusAfterRefund(tx, 'pa', now), 1);
    assert.equal(rows[1].startsAt.getTime(), now.getTime(), 'later pass now starts today');
    assert.equal(rows[1].expiresAt.getTime(), day(365).getTime(), 'refunded 20 unused days removed: 385 -> 365');
    // Refund of a not-yet-started stacked pass removes all of its days from passes after it.
    rows.push({ id: 'c', userId: 'u', kind: 'plus', status: 'active', importPaymentId: 'pc', startsAt: day(365), expiresAt: day(395) });
    await shiftStackedPlusAfterRefund(tx, 'pb', now);
    assert.equal(rows[2].expiresAt.getTime(), day(30).getTime(), '365 removed from the chain');
  }
  // PAY1-06: only allowlisted Atmos fields are stored/logged; no card mask, phone or token.
  {
    const raw = { result: { code: 'OK', description: 'Card 8600 12** **** 3456 phone 998901234567' }, store_transaction: { transaction_id: 1, success_trans_id: 2, card_id: 'tok', pan: '860012******3456', phone: '99890***4567', ofd_url: 'https://ofd.uz/x', amount: 100 }, card_token: 't' };
    const kept = JSON.stringify(redactAtmosRaw(raw));
    assert.ok(!/3456|4567|8600|998901|"tok"|card_token|"pan"|"phone"/.test(kept), kept);
    assert.match(kept, /success_trans_id/);
    const log = atmosLogSummary(raw);
    assert.ok(!/8600|3456|998901234567/.test(log), log);
  }

  console.log('plus-pass.test: ok');
}
main().catch((e) => { console.error(e); process.exit(1); });
