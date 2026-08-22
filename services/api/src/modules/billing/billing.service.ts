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
function enrichPlan(plan: SubscriptionPlan) {
  const isPremium = plan.tier === 'premium';
  const priceMonthly = Number(plan.priceMonthly ?? 0);
  return {
    ...plan,
    priceMonthly,
    priceLabel: priceMonthly > 0 ? `$${priceMonthly}` : 'Free',
    priceUnit: priceMonthly > 0 ? '/mo' : '',
    popular: isPremium,
    features: isPremium
      ? [
          'Unlimited AI lookups',
          'Unlimited content imports',
          'Offline reading mode',
          'Priority support',
          'No ads',
        ]
      : [
          `${plan.aiDailyQuota} AI lookups/day`,
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
