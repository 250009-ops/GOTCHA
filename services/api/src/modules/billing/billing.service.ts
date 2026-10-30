import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_SETTING_KEYS,
  coerceNonNegInt,
  defaultAiPlatformSettings,
  resolveLearnerDailyAiQuota,
} from '../ai/ai-settings';
import { ImportCommerceService } from './import-commerce.service';
import { PricingService, type PricingLang } from './pricing.service';

/** Subscription view of a plan row: DB values only (no prices or feature copy in code). */
function enrichPlan(plan: SubscriptionPlan) {
  const priceUzs = Math.round(Number(plan.priceMonthly ?? 0));
  return {
    ...plan,
    priceMonthly: priceUzs,
    priceUzs,
    currency: 'UZS' as const,
    features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
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
    return (await this.pricing.publicPlans(lang)).map((p) => ({ ...p, priceMonthly: p.period === 'month' ? p.priceUzs : null }));
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
