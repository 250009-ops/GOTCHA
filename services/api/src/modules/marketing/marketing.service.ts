import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const UNLIMITED_THRESHOLD = 1_000_000;

@Injectable()
export class MarketingService {
  constructor(private prisma: PrismaService) {}

  async stats() {
    const learnerCount = await this.prisma.user.count();
    return {
      learnerCount: Math.max(learnerCount, 0),
      /** Design fallback used by marketing when DB is empty / early. */
      displayLearnerCount: Math.max(learnerCount, 12_840),
    };
  }

  async plans() {
    const plans = await this.prisma.subscriptionPlan.findMany({
      orderBy: { tier: 'asc' },
    });

    return plans.map((plan) => {
      const unlimitedLookups = plan.aiDailyQuota >= UNLIMITED_THRESHOLD;
      const unlimitedImports = plan.importLimit >= UNLIMITED_THRESHOLD;
      const price = Number(plan.priceMonthly ?? 0);

      const features =
        plan.tier === 'free'
          ? [
              'Access to public library',
              `${plan.aiDailyQuota} AI lookups / day`,
              `${plan.importLimit} imports per month`,
              'Basic SRS review',
              '7-day reading history',
            ]
          : [
              'Everything in Free',
              unlimitedLookups ? 'Unlimited AI lookups' : `${plan.aiDailyQuota} AI lookups / day`,
              unlimitedImports ? 'Unlimited imports' : `${plan.importLimit} imports`,
              'Full reading analytics',
              plan.offlineEnabled ? 'Offline reading' : 'Online reading',
              'Priority support',
            ];

      return {
        id: plan.id,
        tier: plan.tier,
        name: plan.name,
        priceMonthly: price,
        priceLabel: plan.tier === 'free' ? '$0' : `$${Number.isInteger(price) ? price : price.toFixed(2)}`,
        priceUnit: plan.tier === 'free' ? 'forever' : 'per month',
        aiDailyQuota: plan.aiDailyQuota,
        importLimit: plan.importLimit,
        offlineEnabled: plan.offlineEnabled,
        unlimitedLookups,
        unlimitedImports,
        popular: plan.tier === 'premium',
        cta: plan.tier === 'free' ? 'Get started' : 'Start free trial',
        features,
      };
    });
  }
}
