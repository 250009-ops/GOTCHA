import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LimitsService {
  constructor(private prisma: PrismaService) {}

  async getActivePlan(userId: string) {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return sub?.plan ?? null;
  }

  async assertImportAllowed(userId: string) {
    const plan = await this.getActivePlan(userId);
    const limit = plan?.importLimit ?? 3;
    // Values >= 1e6 are treated as unlimited (Premium / Figma "Unlimited imports").
    if (limit >= 1_000_000) return;
    const count = await this.prisma.userImport.count({ where: { userId } });
    if (count >= limit) {
      throw new ForbiddenException(`Import limit reached (${limit}). Upgrade to Premium for more.`);
    }
  }

  async assertQuizAllowed(userId: string) {
    const plan = await this.getActivePlan(userId);
    const quota = plan?.aiDailyQuota ?? 50;
    if (quota >= 1_000_000) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_usageDate: { userId, usageDate: today } },
    });
    if ((usage?.quizCount ?? 0) >= quota) {
      throw new ForbiddenException('Daily AI quiz quota exceeded');
    }
  }

  async incrementQuizUsage(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.aiUsageDaily.upsert({
      where: { userId_usageDate: { userId, usageDate: today } },
      create: { userId, usageDate: today, quizCount: 1 },
      update: { quizCount: { increment: 1 } },
    });
  }
}
