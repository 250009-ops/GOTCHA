/**
 * round-3b WLF-15: an active Plus user gets the Plus import pool (importFreeLimits.plusDailyImportsPerUser /
 * plusMonthlyPageLimit) and never sees "Free import limit reached". WLF-17: admin billingTier shows Plus.
 */
import assert from 'node:assert/strict';
import { ImportCommerceService } from './import-commerce.service';
import { AdminService } from '../admin/admin.service';

function svc(plus: boolean, limits: Record<string, unknown>, usedToday: number) {
  const prisma: any = {
    platformSetting: { findUnique: async ({ where }: any) => (where.key === 'importFreeLimits' ? { value: limits } : null), findMany: async () => [] },
    userSubscription: { findFirst: async () => (plus ? { status: 'active', plan: { tier: 'premium' } } : null) },
    entitlement: { findFirst: async () => null },
  };
  const s = Object.create(ImportCommerceService.prototype) as any;
  s.prisma = prisma; s.gatewayEnabled = () => false;
  s.freeUsage = async () => ({ dailyFreeUsed: usedToday, monthlyPagesUsed: 0 });
  return s;
}

(async () => {
  const limits = { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50, plusDailyImportsPerUser: 20, plusMonthlyPageLimit: 1000 };
  const free = await svc(false, limits, 3).learnerAllowance('u');
  assert.equal(free.tier, 'free'); assert.equal(free.dailyFreeImportsPerUser, 3); assert.equal(free.dailyFreeRemaining, 0);
  const plus = await svc(true, limits, 3).learnerAllowance('u');
  assert.equal(plus.tier, 'plus'); assert.equal(plus.dailyFreeImportsPerUser, 20); assert.equal(plus.monthlyFreePageLimit, 1000);
  assert.equal(plus.dailyFreeRemaining, 17, 'QA repro: the 4th import of a Plus user is allowed');
  // Plus caps unset → same numbers as Free, but the message never calls a Plus user Free.
  const s = svc(true, { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50 }, 3);
  const err: any = await s.grantFreeImportCredit('u', 'article', 1).catch((e: any) => e);
  const body = err.getResponse();
  assert.equal(body.code, 'IMPORT_LIMIT_REACHED'); assert.equal(body.tier, 'plus');
  assert.equal(body.message, 'Import limit reached: 3 imports a day.'); assert.ok(!/free/i.test(body.message));
  const errFree: any = await svc(false, limits, 3).grantFreeImportCredit('u', 'article', 1).catch((e: any) => e);
  assert.match(errFree.getResponse().message, /^Free import limit reached: 3 imports a day\.$/);

  // WLF-17
  const a = Object.create(AdminService.prototype) as any; a.langLabel = (x: string) => x;
  const base = { id: 'u', email: 'e', displayName: 'd', avatarUrl: null, createdAt: new Date(), streakCount: 0, targetLanguages: [] };
  const row = (subs: any[], payAsYouGo = false) => a.mapUserRow({ ...base, subscriptions: subs }, { payAsYouGo }).billingTier;
  assert.equal(row([{ status: 'active', currentPeriodEnd: null, plan: { name: 'Plus', tier: 'premium' } }]), 'Plus');
  assert.equal(row([{ status: 'active', currentPeriodEnd: new Date(Date.now() + 864e5), plan: { name: 'Plus', tier: 'premium' } }], true), 'Plus');
  assert.equal(row([{ status: 'active', currentPeriodEnd: new Date(Date.now() - 1000), plan: { name: 'Plus', tier: 'premium' } }]), 'Free');
  assert.equal(row([{ status: 'cancelled', currentPeriodEnd: null, plan: { name: 'Plus', tier: 'premium' } }], true), 'Pay as you go');
  assert.equal(row([]), 'Free');
  console.log('wlf15-17-plus-tier: OK');
})().catch((e) => { console.error(e); process.exit(1); });
