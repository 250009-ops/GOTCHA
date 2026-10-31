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
import { LIMIT_TIMEZONE, freeLimits, nextLimitResetAt, planLimits, refreshPlanLimits } from '../../common/plan-limits';

/** final-5 B1: Free import allowance shown on plans = platform_settings importFreeLimits (never subscription_plans.import_limit). */
export type FreeImportView = { dailyFreeImportsPerUser: number; monthlyFreePageLimit: number; resetCycle?: string };
const DEFAULT_FREE_IMPORTS: FreeImportView = { dailyFreeImportsPerUser: 3, monthlyFreePageLimit: 50, resetCycle: 'monthly' };

/**
 * Plan rows → client view. Copy is limited to true claims (marketing/plan-copy.ts, PLUS-OFFER.md); prices in soʻm.
 */
export function enrichPlan(plan: SubscriptionPlan, lang: PlanLang = 'en', yearRaw?: unknown, imports: FreeImportView = DEFAULT_FREE_IMPORTS) {
  const t = planCopy(lang);
  const isPremium = plan.tier === 'premium';
  // Limits shown AND enforced come from one config (common/plan-limits.ts), never the DB row.
  const limits = planLimits(isPremium ? 'premium' : 'free');
  if (!isPremium) {
    const daily = Math.max(0, Math.floor(Number(imports.dailyFreeImportsPerUser) || 0));
    const pages = Math.max(0, Math.floor(Number(imports.monthlyFreePageLimit) || 0));
    const cycle = (['daily', 'monthly', 'yearly'].includes(String(imports.resetCycle)) ? imports.resetCycle : 'monthly') as 'daily' | 'monthly' | 'yearly';
    return {
      ...plan,
      name: t.freeName,
      importLimit: daily,
      monthlyFreePageLimit: pages,
      offlineEnabled: false,
      priceMonthly: 0,
      priceUzs: 0,
      currency: 'UZS' as const,
      priceLabel: t.free,
      priceUnit: '',
      popular: false,
      aiDailyQuota: limits.lookupsPerDay,
      quizDailyQuota: limits.quizzesPerDay,
      features: [t.lookupsDay(freeLimits().lookupsPerDay), t.quizzesDay(limits.quizzesPerDay), t.importsDay(daily), t.importPages(pages, cycle), t.library],
    };
  }
  // Premium = Plus, a 30-day pass (no auto-renew). Field names (incl. priceMonthly) are kept for old clients;
  // priceMonthly now means "price of the 30-day pass". A price < 1000 soʻm (e.g. the live USD "9") is hidden.
  const priceUzs = publicPlanPriceUzs(plan.priceMonthly);
  const priceYearUzs = publicPlanPriceUzs(yearRaw);
  return {
    ...plan,
    name: t.plusName,
    importLimit: null,
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
    await refreshPlanLimits(this.prisma);
    const imports = await this.importCommerce.getFreeLimits().catch(() => DEFAULT_FREE_IMPORTS);
    return plans.map((p) => enrichPlan(p, lang, year?.value, imports));
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
    await refreshPlanLimits(this.prisma);
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
        resetAt: nextLimitResetAt().toISOString(), // B5: counters reset at midnight Asia/Tashkent
        timezone: LIMIT_TIMEZONE,
      },
    };
  }
}
