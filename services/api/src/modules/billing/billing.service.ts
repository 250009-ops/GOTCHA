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
export function enrichPlan(plan: SubscriptionPlan, lang: PlanLang = 'en', yearRaw?: unknown, freeQuota: number = DAILY_CAP_FALLBACKS.free.lookups, freeQuizzes: number = DAILY_CAP_FALLBACKS.free.quizzes, plusLookups: number | null = DAILY_CAP_FALLBACKS.plus.lookups, freeImportsDay?: number) {
  const t = planCopy(lang);
  const isPremium = plan.tier === 'premium';
  if (!isPremium) {
    return {
      ...plan,
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
      features: [t.lookupsDay(freeQuota), t.quizzesDay(freeQuizzes), t.importsDay(freeImportsDay ?? plan.importLimit), t.library],
    };
  }
  // Premium = Plus, a 30-day pass (no auto-renew). Field names (incl. priceMonthly) are kept for old clients;
  // priceMonthly now means "price of the 30-day pass". A price < 1000 soʻm (e.g. the live USD "9") is hidden.
  const priceUzs = publicPlanPriceUzs(plan.priceMonthly);
  const priceYearUzs = publicPlanPriceUzs(yearRaw);
  return {
    ...plan,
    name: t.plusName,
    importLimit: freeImportsDay ?? plan.importLimit, // PAY2-18: same enforced free import allowance, not the seed row
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
    quizDailyQuota: (plan as { quizDailyQuota?: number }).quizDailyQuota ?? DAILY_CAP_FALLBACKS.plus.quizzes,
    // Lookups from config (plus.ai_lookup_quota, null = no daily limit); never "unlimited" in copy.
    // Marketing §4/§7 (14:20): quiz bullet added; quiz cap = plan.quizDailyQuota.
    features: [t.plusLookups(plusLookups, freeQuota), t.plusQuizzes((plan as { quizDailyQuota?: number }).quizDailyQuota ?? DAILY_CAP_FALLBACKS.plus.quizzes, freeQuizzes), t.plusFree],
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
    const freeImports = await freeImportsPerDay(this.prisma);
    return plans.map((p) => enrichPlan(p, lang as PlanLang, year?.value, caps.free.lookups, caps.free.quizzes, caps.plus.lookups, freeImports));
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
      subscription: sub ? { ...sub, plan: enrichPlan(sub.plan, 'en', undefined, caps.free.lookups, caps.free.quizzes, caps.plus.lookups) } : null,
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
