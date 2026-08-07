import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LimitsService {
  constructor(private prisma: PrismaService) {}

  /** Dev / local demos: skip import quota when explicitly enabled. */
  private devUnlimitedImports(): boolean {
    const flag = (process.env.DEV_UNLIMITED_IMPORTS ?? '').toLowerCase();
    if (flag === 'true' || flag === '1' || flag === 'yes') return true;
    return false;
  }

  async getActivePlan(userId: string) {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
    return sub?.plan ?? null;
  }

  async getImportQuota(userId: string) {
    if (this.devUnlimitedImports()) {
      const count = await this.prisma.userImport.count({ where: { userId } });
      return {
        limit: null as number | null,
        count,
        unlimited: true,
        remaining: null as number | null,
      };
    }

    const plan = await this.getActivePlan(userId);
    // Default free-tier fallback raised for professional demos (seed Free plan = 15).
    const limit = plan?.importLimit ?? 15;
    const unlimited = limit >= 1_000_000;
    const count = await this.prisma.userImport.count({ where: { userId } });
    return {
      limit: unlimited ? null : limit,
      count,
      unlimited,
      remaining: unlimited ? null : Math.max(0, limit - count),
    };
  }

  async assertImportAllowed(userId: string) {
    const quota = await this.getImportQuota(userId);
    // Values >= 1e6 are treated as unlimited (Premium / Figma "Unlimited imports").
    if (quota.unlimited || quota.limit == null) return;
    if (quota.count >= quota.limit) {
      throw new ForbiddenException(
        `Import limit reached (${quota.limit}). Upgrade to Premium for more.`,
      );
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
