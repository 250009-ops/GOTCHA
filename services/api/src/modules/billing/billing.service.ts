import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_SETTING_KEYS,
  coerceNonNegInt,
  defaultAiPlatformSettings,
  resolveLearnerDailyAiQuota,
} from '../ai/ai-settings';
import { formatSom, planCopy, publicPlanPriceUzs, type PlanLang } from '../marketing/plan-copy';
import { ImportCommerceService } from './import-commerce.service';
import { freeLimits, planLimits } from '../../common/plan-limits';

/**
 * Plan rows → client view. Copy is limited to true claims (marketing/plan-copy.ts, PLUS-OFFER.md); prices in soʻm.
 */
export function enrichPlan(plan: SubscriptionPlan, lang: PlanLang = 'en', yearRaw?: unknown) {
  const t = planCopy(lang);
  const isPremium = plan.tier === 'premium';
  // Limits shown AND enforced come from one config (common/plan-limits.ts), never the DB row.
  const limits = planLimits(isPremium ? 'premium' : 'free');
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
      aiDailyQuota: limits.lookupsPerDay,
      quizDailyQuota: limits.quizzesPerDay,
      features: [t.lookupsDay(freeLimits().lookupsPerDay), t.quizzesDay(limits.quizzesPerDay), t.importsDay(plan.importLimit), t.library],
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
    aiDailyQuota: null, // no daily lookup cap for Plus (14:40)
    quizDailyQuota: limits.quizzesPerDay,
    features: [t.plusLookups, t.plusQuizzes(limits.quizzesPerDay), t.plusFree],
  };
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private importCommerce: ImportCommerceService,
  ) {}

  async listPlans(lang: PlanLang = 'en') {
    const [plans, year] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
      this.prisma.platformSetting.findUnique({ where: { key: 'plus.pass.price_365_uzs' } }).catch(() => null),
    ]);
    return plans.map((p) => enrichPlan(p, lang, year?.value));
  }

  async getSubscription(userId: string) {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [usage, quotaRow, importAllowance] = await Promise.all([
      this.prisma.aiUsageDaily.findUnique({
        where: { userId_usageDate: { userId, usageDate: today } },
      }),
      this.prisma.platformSetting.findUnique({ where: { key: AI_SETTING_KEYS.defaultUserQuota } }),
      this.importCommerce.learnerAllowance(userId),
    ]);
    const platformDefault = coerceNonNegInt(
      quotaRow?.value,
      defaultAiPlatformSettings().defaultUserQuota,
    );
    void platformDefault; void resolveLearnerDailyAiQuota;
    const quota = planLimits(sub?.plan.tier).lookupsPerDay;
    const quizQuota = planLimits(sub?.plan.tier).quizzesPerDay;

    return {
      subscription: sub ? { ...sub, plan: enrichPlan(sub.plan) } : null,
      usage: {
        lookupsToday: usage?.lookupCount ?? 0,
        quizzesToday: usage?.quizCount ?? 0,
        quota,
        quizQuota,
        importAllowance,
      },
    };
  }
}
