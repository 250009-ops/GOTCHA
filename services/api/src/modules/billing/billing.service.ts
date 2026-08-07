import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } });
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
      subscription: sub,
      usage: {
        lookupsToday: usage?.lookupCount ?? 0,
        quizzesToday: usage?.quizCount ?? 0,
        quota: sub?.plan.aiDailyQuota ?? 50,
      },
    };
  }
}
