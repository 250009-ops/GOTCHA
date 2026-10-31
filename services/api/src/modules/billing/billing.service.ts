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

/**
 * Synthesize the `features`, `priceLabel`, `priceUnit`, and `popular` fields
 * that the frontend expects but aren't columns in the DB schema.
 * See docs/E2E_AUDIT_REPORT.md item #8 for context.
 */
/** LG4-07: real Plus terms only (one-off passes in soʻm, no auto-renew, no offline/unlimited/ads claims). */
export const PLUS_PASS_PRICES_UZS = { days30: 24990, days365: 199990 } as const;
import { planLimits } from '../../common/plan-limits';
const soum = (n: number) => `${n.toLocaleString('en-US').replace(/,/g, ' ')} soʻm`;

export function enrichPlan(plan: SubscriptionPlan) {
  const isPremium = plan.tier === 'premium';
  const limits = planLimits(isPremium ? 'premium' : 'free');
  const priceMonthly = isPremium ? PLUS_PASS_PRICES_UZS.days30 : 0;
  return {
    ...plan,
    name: isPremium ? 'Plus' : plan.name,
    offlineEnabled: false,
    aiDailyQuota: limits.lookupsPerDay,
    quizDailyQuota: limits.quizzesPerDay,
    priceMonthly,
    priceYearUzs: isPremium ? PLUS_PASS_PRICES_UZS.days365 : null,
    periodDays: isPremium ? 30 : null,
    autoRenew: false,
    priceLabel: isPremium ? soum(PLUS_PASS_PRICES_UZS.days30) : 'Free',
    priceUnit: isPremium ? '30-day pass' : '',
    popular: isPremium,
    features: isPremium
      ? [
          `${limits.lookupsPerDay} AI lookups/day`,
          `${limits.quizzesPerDay} quizzes/day`,
          '50% off paid imports',
          `30-day pass ${soum(PLUS_PASS_PRICES_UZS.days30)} or 365-day pass ${soum(PLUS_PASS_PRICES_UZS.days365)}`,
          'One-off payment, no auto-renewal',
        ]
      : [
          `${limits.lookupsPerDay} AI lookups/day`,
          `${limits.quizzesPerDay} quizzes/day`,
          `${plan.importLimit} free imports/day`,
          'Access to public library',
        ],
  };
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private importCommerce: ImportCommerceService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } });
    return plans.map(enrichPlan);
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
