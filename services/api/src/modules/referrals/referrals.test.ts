import * as assert from 'node:assert/strict';
import { randomUUID } from 'crypto';
import { ReferralService, choosePlusDiscount } from './referral.service';
import { parseStartParam, referralCapture } from './capture';

function memory() {
  const users: Array<Record<string, unknown>> = [];
  const codes: Array<Record<string, unknown>> = [];
  const referrals: Array<Record<string, unknown>> = [];
  const payments: Array<Record<string, unknown>> = [];
  const entitlements: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const pushes: Array<Record<string, unknown>> = [];
  const settings = [
    { key: 'referral.friend_discount_pct', value: 20 },
    { key: 'referral.referrer_reward_days', value: 30 },
    { key: 'referral.max_rewards_per_year', value: 12 },
    { key: 'referral.enabled', value: true },
  ];
  const match = (row: Record<string, unknown>, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      if (value && typeof value === 'object' && 'gte' in (value as object)) {
        return (row[key] as Date) >= (value as { gte: Date }).gte;
      }
      if (value && typeof value === 'object' && 'in' in (value as object)) {
        return (value as { in: unknown[] }).in.includes(row[key]);
      }
      if (value && typeof value === 'object' && 'startsWith' in (value as object)) {
        return String(row[key] ?? '').startsWith((value as { startsWith: string }).startsWith);
      }
      return row[key] === value;
    });
  const prisma = {
    platformSetting: {
      findMany: async () => settings,
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => users.find((row) => row.id === where.id) ?? null,
    },
    referralCode: {
      findUnique: async ({ where, include }: { where: { code?: string; userId?: string }; include?: { user?: boolean } }) => {
        const row = codes.find((item) => (where.code ? item.code === where.code : item.userId === where.userId));
        if (!row) return null;
        if (include?.user) row.user = users.find((user) => user.id === row.userId) ?? null;
        return row;
      },
    },
    referral: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: randomUUID(), createdAt: new Date(), rewardPaymentId: null, rewardedAt: null, ...data };
        referrals.push(row);
        return row;
      },
      findUnique: async ({ where }: { where: { refereeId?: string; id?: string } }) =>
        referrals.find((row) => (where.refereeId ? row.refereeId === where.refereeId : row.id === where.id)) ?? null,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        referrals.find((row) => match(row, where)) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = referrals.find((item) => item.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const row of referrals) {
          if (!match(row, where)) continue;
          Object.assign(row, data);
          count += 1;
        }
        return { count };
      },
      count: async ({ where }: { where: Record<string, unknown> }) => referrals.filter((row) => match(row, where)).length,
    },
    importPayment: {
      count: async ({ where }: { where: Record<string, unknown> }) => payments.filter((row) => match(row, where)).length,
    },
    entitlement: {
      findFirst: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        entitlements.push(data);
        return data;
      },
    },
    subscriptionPlan: { findUnique: async () => ({ id: 'plus-plan' }) },
    userSubscription: { create: async () => ({}) },
    auditLog: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        audits.push(data);
        return data;
      },
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  const notifications = { push: async (userId: string, draft: Record<string, unknown>) => { pushes.push({ userId, draft }); } };
  return { prisma, users, codes, referrals, payments, entitlements, audits, pushes, notifications };
}

async function main() {
  const captured = referralCapture('dilnoza', '/register');
  assert.ok(captured);
  assert.equal(captured.code, 'DILNOZA');
  assert.match(captured.cookie, /^gotcha_ref=DILNOZA;/);
  assert.match(captured.cookie, /Max-Age=2592000/);
  assert.match(captured.cookie, /SameSite=Lax/);
  assert.equal(captured.location, '/register?ref=DILNOZA');
  const start = parseStartParam('r_DILNOZA');
  assert.equal(start.type, 'referral');
  if (start.type === 'referral') assert.equal(start.code, 'DILNOZA');

  const bag = memory();
  bag.users.push(
    { id: 'referrer', displayName: 'Aziz Rahimov', phone: '+998901110000', telegramId: 1n, uiLanguage: 'uz' },
    { id: 'friend', displayName: 'Malika T.', phone: '+998902220000', telegramId: 2n, uiLanguage: 'uz' },
    { id: 'self', displayName: 'Aziz Rahimov', phone: '+998901110000', telegramId: 1n, uiLanguage: 'uz' },
  );
  bag.codes.push({ userId: 'referrer', code: 'AZIZ' });
  const service = new ReferralService(bag.prisma as never, bag.notifications as never);

  const fromWeb = await service.attachNewUser({ refereeId: 'friend', code: 'aziz', source: 'web' });
  assert.ok(fromWeb);
  assert.equal(bag.referrals[0].source, 'web');
  assert.equal(bag.referrals[0].code, 'AZIZ');
  const again = await service.attachNewUser({ refereeId: 'friend', code: 'AZIZ', source: 'telegram' });
  assert.equal(again, null);

  const fromStart = await service.attachNewUser({
    refereeId: 'new-friend',
    code: start.type === 'referral' ? start.code : '',
    source: 'telegram',
    phone: '+998903330000',
    telegramId: 9n,
  });
  assert.equal(fromStart, null);
  bag.codes[0].code = 'DILNOZA';
  const attached = await service.attachNewUser({
    refereeId: 'new-friend',
    code: 'r_DILNOZA',
    source: 'telegram',
  });
  assert.ok(attached);
  assert.equal(bag.referrals.at(-1)?.source, 'telegram');

  const selfUser = await service.attachNewUser({ refereeId: 'referrer', code: 'DILNOZA', source: 'web' });
  const selfPhone = await service.attachNewUser({ refereeId: 'someone', code: 'DILNOZA', source: 'web', phone: '+998901110000' });
  const selfTelegram = await service.attachNewUser({ refereeId: 'someone-else', code: 'DILNOZA', source: 'telegram', telegramId: 1n });
  assert.equal(selfUser, null);
  assert.equal(selfPhone, null);
  assert.equal(selfTelegram, null);

  const promoWins = choosePlusDiscount({
    listTiyins: 1_000_000,
    referralPct: 20,
    promo: { percentOff: 30, amountOffUzs: null },
    minTiyins: 0,
    locale: 'uz',
  });
  assert.equal(promoWins.source, 'promo');
  assert.equal(promoWins.line, null);
  assert.equal(promoWins.amountTiyins, 700_000);
  const referralWins = choosePlusDiscount({
    listTiyins: 1_000_000,
    referralPct: 20,
    promo: { percentOff: 10, amountOffUzs: null },
    minTiyins: 0,
    locale: 'uz',
  });
  assert.equal(referralWins.source, 'referral');
  assert.equal(referralWins.line, 'Taklif chegirmasi −20%');
  assert.equal(referralWins.amountTiyins, 800_000);

  assert.equal(await service.eligiblePct('friend'), 20);
  bag.payments.push({ userId: 'friend', status: 'paid', contentFormat: 'plus_pass:30' });
  assert.equal(await service.eligiblePct('friend'), null);

  bag.payments.length = 0;
  bag.payments.push({ userId: 'friend', status: 'paid', contentFormat: 'plus_pass:30' });
  await service.onRefereePlusPaid({ id: 'pay-1', userId: 'friend' });
  await service.onRefereePlusPaid({ id: 'pay-1', userId: 'friend' });
  assert.equal(bag.entitlements.length, 1);
  assert.equal(bag.pushes.length, 1);
  assert.equal(bag.referrals.find((row) => row.refereeId === 'friend')?.status, 'rewarded');
  assert.match(String((bag.pushes[0].draft as { body?: string }).body), /Doʻstingiz Plus oldi — sizga \+30 kun Plus qoʻshildi/);

  const capped = memory();
  capped.users.push({ id: 'referrer', displayName: 'Aziz Rahimov', uiLanguage: 'uz' }, { id: 'thirteenth', uiLanguage: 'uz' });
  capped.codes.push({ userId: 'referrer', code: 'AZIZ' });
  for (let n = 0; n < 12; n += 1) {
    capped.referrals.push({
      id: `old-${n}`,
      referrerId: 'referrer',
      refereeId: `old-user-${n}`,
      status: 'rewarded',
      rewardedAt: new Date(),
      code: 'AZIZ',
    });
  }
  capped.referrals.push({
    id: 'fresh',
    referrerId: 'referrer',
    refereeId: 'thirteenth',
    status: 'registered',
    code: 'AZIZ',
    rewardPaymentId: null,
    rewardedAt: null,
  });
  capped.payments.push({ userId: 'thirteenth', status: 'paid', contentFormat: 'plus_pass:30' });
  const cappedService = new ReferralService(capped.prisma as never, capped.notifications as never);
  await cappedService.onRefereePlusPaid({ id: 'pay-13', userId: 'thirteenth' });
  assert.equal(capped.entitlements.length, 0);
  assert.equal(capped.pushes.length, 0);
  assert.equal(capped.referrals.find((row) => row.id === 'fresh')?.status, 'registered');
  assert.equal(capped.audits[0]?.action, 'referral.cap');

  const kept = bag.entitlements.length;
  await service.onPlusRefunded({ id: 'pay-1', userId: 'friend' });
  assert.equal(bag.referrals.find((row) => row.refereeId === 'friend')?.status, 'void');
  assert.equal(bag.entitlements.length, kept);
  assert.equal(bag.audits.at(-1)?.action, 'referral.void');

  console.log('referrals.test.ts ok');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
