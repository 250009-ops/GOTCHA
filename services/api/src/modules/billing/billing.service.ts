import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_SETTING_KEYS,
  coerceNonNegInt,
  defaultAiPlatformSettings,
  resolveLearnerDailyAiQuota,
} from '../ai/ai-settings';
import { formatSom, planCopy, type PlanLang } from '../marketing/plan-copy';
import { ImportCommerceService } from './import-commerce.service';

/**
 * Plan rows → client view. Copy is limited to true claims (marketing/plan-copy.ts, PLUS-OFFER.md); prices in soʻm.
 */
export function enrichPlan(plan: SubscriptionPlan, lang: PlanLang = 'en') {
  const t = planCopy(lang);
  const isPremium = plan.tier === 'premium';
  const priceUzs = Math.round(Number(plan.priceMonthly ?? 0));
  return {
    ...plan,
    offlineEnabled: false,
    priceMonthly: priceUzs,
    priceUzs,
    currency: 'UZS' as const,
    priceLabel: priceUzs > 0 ? formatSom(priceUzs, lang) : t.free,
    priceUnit: '',
    popular: isPremium,
    features: isPremium
      ? [t.plusLookups, t.plusFree]
      : [t.lookupsDay(plan.aiDailyQuota), t.importsDay(plan.importLimit), t.library],
  };
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private importCommerce: ImportCommerceService,
  ) {}

  async listPlans(lang: PlanLang = 'en') {
    const plans = await this.prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } });
    return plans.map((p) => enrichPlan(p, lang));
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
    const quota = resolveLearnerDailyAiQuota(sub?.plan.aiDailyQuota, platformDefault);

    return {
      subscription: sub ? { ...sub, plan: enrichPlan(sub.plan) } : null,
      usage: {
        lookupsToday: usage?.lookupCount ?? 0,
        quizzesToday: usage?.quizCount ?? 0,
        quota,
        importAllowance,
      },
    };
  }
}
