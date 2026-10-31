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
export function enrichPlan(plan: SubscriptionPlan, lang: PlanLang = 'en', yearRaw?: unknown, freeQuota: number = DAILY_CAP_FALLBACKS.free.lookups, freeQuizzes: number = DAILY_CAP_FALLBACKS.free.quizzes, plusLookups: number | null = DAILY_CAP_FALLBACKS.plus.lookups) {
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
      features: [t.lookupsDay(plan.aiDailyQuota), t.importsDay(plan.importLimit), t.library],
    };
  }
  // Premium = Plus, a 30-day pass (no auto-renew). Field names (incl. priceMonthly) are kept for old clients;
  // priceMonthly now means "price of the 30-day pass". A price < 1000 soʻm (e.g. the live USD "9") is hidden.
  const priceUzs = publicPlanPriceUzs(plan.priceMonthly);
  const priceYearUzs = publicPlanPriceUzs(yearRaw);
  return {
    ...plan,
    name: t.plusName,
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
    // Lookups from config (plus.ai_lookup_quota, null = no daily limit); never "unlimited" in copy.
    // Marketing §4/§7 (14:20): quiz bullet added; quiz cap = plan.quizDailyQuota.
    features: [t.plusLookups(plusLookups, freeQuota), t.plusQuizzes((plan as { quizDailyQuota?: number }).quizDailyQuota ?? DAILY_CAP_FALLBACKS.plus.quizzes, freeQuizzes), t.plusFree],
  };
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private importCommerce: ImportCommerceService,
    private pricing: PricingService,
  ) {}

  /** No prices in code: everything comes from subscription_plans (PRICING.md seed, admin-edited). */
  async listPlans(lang: PricingLang = 'en') {
    // AC1-01 safety net: a premium price < 1000 soʻm (e.g. an old USD value) is hidden, never shown as "9 soʻm".
    // Field names (incl. priceMonthly) are kept for old clients; for Plus it is the 30-day pass price.
    return (await this.pricing.publicPlans(lang)).map((p) => {
      if (p.tier !== 'premium') return { ...p, priceMonthly: p.period === 'month' ? p.priceUzs : null };
      const priceUzs = publicPlanPriceUzs(p.priceUzs);
      return { ...p, priceUzs, priceMonthly: priceUzs, priceHidden: priceUzs === null, priceUnit: planCopy(lang as PlanLang).passUnit, periodDays: 30, autoRenew: false };
    });
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
