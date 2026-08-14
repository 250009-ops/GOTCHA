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

  /**
   * Public marketing pricing copy. There is NO recurring subscription in this product —
   * learners get a free allowance and pay Atmos once, per import, only when they exceed it.
   * The `free` tier is real and reads live quotas from `SubscriptionPlan`. The second card is
   * NOT sourced from `SubscriptionPlan.premium` (that row's `priceMonthly` is an internal-only
   * value used by the admin "adjust tier" override / AI quota system — it was never a real,
   * purchasable $/mo product, see docs/E2E_AUDIT_REPORT.md §7.2) — it's static, honest copy
   * describing the real pay-per-import model instead.
   */
  async plans() {
    const freePlan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: 'free' } });

    const aiDailyQuota = freePlan?.aiDailyQuota ?? 50;
    const importLimit = freePlan?.importLimit ?? 15;

    const free = {
      id: freePlan?.id ?? 'free',
      tier: 'free' as const,
      name: freePlan?.name ?? 'Free',
      priceMonthly: 0,
      priceLabel: '$0',
      priceUnit: 'forever',
      aiDailyQuota,
      importLimit,
      offlineEnabled: freePlan?.offlineEnabled ?? false,
      unlimitedLookups: aiDailyQuota >= UNLIMITED_THRESHOLD,
      unlimitedImports: importLimit >= UNLIMITED_THRESHOLD,
      popular: false,
      cta: 'Get started',
      features: [
        'Access to public library',
        `${aiDailyQuota} AI lookups / day`,
        `${importLimit} free imports / month`,
        'Basic SRS review',
        '7-day reading history',
      ],
    };

    const payPerImport = {
      id: 'pay-per-import',
      tier: 'pay-per-import' as const,
      name: 'Pay-per-import',
      priceMonthly: 0,
      priceLabel: 'Pay as you go',
      priceUnit: 'no subscription',
      aiDailyQuota,
      importLimit,
      offlineEnabled: true,
      unlimitedLookups: false,
      unlimitedImports: false,
      popular: true,
      cta: 'Start reading for free',
      features: [
        'Everything in Free',
        'No monthly fee, ever',
        'Need more than your free imports? Pay once per import via Atmos',
        'Price shown upfront, based on document length',
        'Full reading analytics',
        'Offline reading',
      ],
    };

    return [free, payPerImport];
  }
}
