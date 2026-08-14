import { Injectable } from '@nestjs/common';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

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
          `${plan.importLimit} imports/month`,
          'Access to public library',
        ],
  };
}

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

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
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_usageDate: { userId, usageDate: today } },
    });

    return {
      subscription: sub ? { ...sub, plan: enrichPlan(sub.plan) } : null,
      usage: {
        lookupsToday: usage?.lookupCount ?? 0,
        quizzesToday: usage?.quizCount ?? 0,
        quota: sub?.plan.aiDailyQuota ?? 50,
      },
    };
  }
}
