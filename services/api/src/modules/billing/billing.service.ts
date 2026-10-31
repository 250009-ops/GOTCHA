import { Injectable } from '@nestjs/common';
import { DAILY_CAP_FALLBACKS } from '@gotcha/shared';
import { activeSubWhere } from '../../common/plan-active';
import { getPlanCaps, usageDayStart, usageResetAt, userCapPlan } from '../../common/plan-caps';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatSom, planCopy, publicPlanPriceUzs, type PlanLang } from '../marketing/plan-copy';
import { ImportCommerceService } from './import-commerce.service';
import { PricingService, type PricingLang } from './pricing.service';

/** Subscription view of a plan row: DB values only (no prices or feature copy in code). */
export function enrichPlan(plan: SubscriptionPlan, lang: PlanLang = 'en', yearRaw?: unknown, freeQuota: number = DAILY_CAP_FALLBACKS.free.lookups, freeQuizzes: number = DAILY_CAP_FALLBACKS.free.quizzes, plusLookups: number | null = DAILY_CAP_FALLBACKS.plus.lookups, freeImportsDay?: number, plusQuizzes: number = DAILY_CAP_FALLBACKS.plus.quizzes, freePages: FreeImportPages = DEFAULT_FREE_IMPORT_PAGES, plusImports?: PlusImportLimits) {
  const t = planCopy(lang);
  const isPremium = plan.tier === 'premium';
  if (!isPremium) {
    return {
      ...plan,
      name: t.freeName, // final-5 B7: localised plan name
      offlineEnabled: false,
      priceMonthly: 0,
      priceUzs: 0,
      currency: 'UZS' as const,
      priceLabel: t.free,
      priceUnit: '',
      popular: false,
      // wlive: shown limits = enforced caps (payments-02 plan-caps), never the raw row.
      aiDailyQuota: freeQuota,
      quizDailyQuota: freeQuizzes,
      // PAY2-18: the import allowance import-commerce enforces (platform setting importFreeLimits, default 3/day), not the seed row (15).
      importLimit: freeImportsDay ?? plan.importLimit,
      monthlyFreePageLimit: freePages.pages, // final-5 B1 field kept for clients
      features: [t.lookupsDay(freeQuota), t.quizzesDay(freeQuizzes), t.importsDay(freeImportsDay ?? plan.importLimit), t.importPages(freePages.pages, freePages.cycle), t.library],
    };
  }
  // Premium = Plus, a 30-day pass (no auto-renew). Field names (incl. priceMonthly) are kept for old clients;
  // priceMonthly now means "price of the 30-day pass". A price < 1000 soʻm (e.g. the live USD "9") is hidden.
  const priceUzs = publicPlanPriceUzs(plan.priceMonthly);
  const priceYearUzs = publicPlanPriceUzs(yearRaw);
  return {
    ...plan,
    name: t.plusName,
    // WLF-29: Plus import pool from importFreeLimits.plus* (unset = Free numbers), as import-commerce enforces.
    importLimit: plusImports?.imports ?? freeImportsDay ?? plan.importLimit,
    monthlyFreePageLimit: plusImports?.pages ?? freePages.pages,
    offlineEnabled: false,
    priceMonthly: priceUzs,
    priceUzs,
    priceYearUzs,
    priceHidden: priceUzs === null,
    currency: 'UZS' as const,
    priceLabel: priceUzs === null ? null : formatSom(priceUzs, lang),
    priceUnit: t.passUnit,
    periodDays: 30,
    autoRenew: false,
    popular: true,
    aiDailyQuota: plusLookups, // null = no daily lookup cap for Plus (wlive 14:40 API shape)
    quizDailyQuota: plusQuizzes, // WLF-12: enforced cap (platform_settings caps.plus.quizzes), not the plan column
    // Lookups from config (plus.ai_lookup_quota, null = no daily limit); never "unlimited" in copy.
    // Marketing §4/§7 (14:20): quiz bullet added; quiz cap = plan.quizDailyQuota.
    features: [t.plusLookups(plusLookups, freeQuota), t.plusQuizzes(plusQuizzes, freeQuizzes), ...(plusImports ? [t.importsDay(plusImports.imports), t.importPages(plusImports.pages, plusImports.cycle)] : []), t.plusFree],
  };
}

/** PAY2-18: Free imports a day = admin Import & Pricing → importFreeLimits.dailyFreeImportsPerUser (default 3), as /marketing/plans. */
export const DEFAULT_FREE_IMPORTS_PER_DAY = 3;
export async function freeImportsPerDay(prisma: { platformSetting: { findUnique(a: { where: { key: string } }): Promise<{ value: unknown } | null> } }): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } }).catch(() => null);
  const v = row?.value && typeof row.value === 'object' ? (row.value as { dailyFreeImportsPerUser?: unknown }).dailyFreeImportsPerUser : undefined;
  const n = Math.floor(Number(v ?? DEFAULT_FREE_IMPORTS_PER_DAY));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_IMPORTS_PER_DAY;
}

/** Kai/Sarvarbek 2026-10-31: Free = 3 imports a day AND 50 pages a month (importFreeLimits.monthlyFreePageLimit / resetCycle). */
export type FreeImportPages = { pages: number; cycle: 'daily' | 'monthly' | 'yearly' };
export const DEFAULT_FREE_IMPORT_PAGES: FreeImportPages = { pages: 50, cycle: 'monthly' };
export async function freeImportPages(prisma: { platformSetting: { findUnique(a: { where: { key: string } }): Promise<{ value: unknown } | null> } }): Promise<FreeImportPages> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } }).catch(() => null);
  const v = (row?.value && typeof row.value === 'object' ? row.value : {}) as { monthlyFreePageLimit?: unknown; resetCycle?: unknown };
  const n = Math.floor(Number(v.monthlyFreePageLimit ?? DEFAULT_FREE_IMPORT_PAGES.pages));
  const cycle = v.resetCycle === 'daily' || v.resetCycle === 'yearly' ? v.resetCycle : 'monthly';
  return { pages: Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_IMPORT_PAGES.pages, cycle };
}

/** WLF-29: Plus import pool = importFreeLimits.plusDailyImportsPerUser / plusMonthlyPageLimit; unset falls back to Free (same rule as import-commerce capOf). */
export type PlusImportLimits = { imports: number; pages: number; cycle: FreeImportPages['cycle'] };
export async function plusImportLimits(prisma: { platformSetting: { findUnique(a: { where: { key: string } }): Promise<{ value: unknown } | null> } }): Promise<PlusImportLimits> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } }).catch(() => null);
  const v = (row?.value && typeof row.value === 'object' ? row.value : {}) as { plusDailyImportsPerUser?: unknown; plusMonthlyPageLimit?: unknown };
  const [freeDay, freePages] = await Promise.all([freeImportsPerDay(prisma), freeImportPages(prisma)]);
  const pick = (x: unknown, d: number) => { if (x == null || x === '') return d; const n = Math.floor(Number(x)); return Number.isFinite(n) && n >= 0 ? n : d; };
  return { imports: pick(v.plusDailyImportsPerUser, freeDay), pages: pick(v.plusMonthlyPageLimit, freePages.pages), cycle: freePages.cycle };
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private importCommerce: ImportCommerceService,
    private pricing: PricingService,
  ) {}

  /** No prices in code: everything comes from subscription_plans (PRICING.md seed, admin-edited). */
  /** wlive behaviour kept: localized plan cards (enrichPlan) with the enforced payments-02 caps. */
  async listPlans(lang: PricingLang = 'en') {
    const [plans, year, caps] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'plus.pass.price_365_uzs' } }).catch(() => null),
      getPlanCaps(this.prisma),
    ]);
    const [freeImports, freePages, plusImports] = await Promise.all([freeImportsPerDay(this.prisma), freeImportPages(this.prisma), plusImportLimits(this.prisma)]);
    return plans.map((p) => enrichPlan(p, lang as PlanLang, year?.value, caps.free.lookups, caps.free.quizzes, caps.plus.lookups, freeImports, caps.plus.quizzes, freePages, plusImports));
  }

  async getSubscription(userId: string) {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, ...activeSubWhere() },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const [usage, caps, plan, importAllowance] = await Promise.all([
      this.prisma.aiUsageDaily.findUnique({
        where: { userId_usageDate: { userId, usageDate: usageDayStart() } },
      }),
      getPlanCaps(this.prisma),
      userCapPlan(this.prisma, userId),
      this.importCommerce.learnerAllowance(userId),
    ]);
    const quota = caps[plan].lookups;

    return {
      subscription: sub ? { ...sub, plan: enrichPlan(sub.plan, 'en', undefined, caps.free.lookups, caps.free.quizzes, caps.plus.lookups, await freeImportsPerDay(this.prisma), caps.plus.quizzes, await freeImportPages(this.prisma), await plusImportLimits(this.prisma)) } : null,
      usage: {
        lookupsToday: usage?.lookupCount ?? 0,
        quizzesToday: usage?.quizCount ?? 0,
        quota,
        quizQuota: caps[plan].quizzes,
        resetAt: usageResetAt().toISOString(),
        importAllowance,
      },
    };
  }
}
