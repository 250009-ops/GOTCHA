import { planLimits } from '../common/plan-limits';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AI_SETTING_KEYS,
  coerceNonNegInt,
  defaultAiPlatformSettings,
} from '../modules/ai/ai-settings';

function envFlagTrue(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

function envFlagFalse(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'false' || v === '0' || v === 'no' || v === 'off';
}

@Injectable()
export class LimitsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Skip commerce import quotas until a payment gateway is live.
   * Priority: IMPORTS_UNLIMITED / DEV_UNLIMITED_IMPORTS → true;
   * otherwise unlimited whenever PAYMENT_GATEWAY_ENABLED is absent/false.
   */
  private importsUnlimitedByConfig(): boolean {
    if (envFlagTrue(process.env.IMPORTS_UNLIMITED) || envFlagTrue(process.env.DEV_UNLIMITED_IMPORTS)) {
      return true;
    }
    if (!envFlagTrue(process.env.PAYMENT_GATEWAY_ENABLED)) {
      return true;
    }
    if (envFlagFalse(process.env.IMPORTS_UNLIMITED)) {
      return false;
    }
    return false;
  }

  /** When gateway is on, imports are gated by free allowance / Atmos payment — not plan count. */
  paymentGatewayEnforcesImports(): boolean {
    return !this.importsUnlimitedByConfig();
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
    if (this.importsUnlimitedByConfig()) {
      const count = await this.prisma.userImport.count({ where: { userId } });
      return {
        limit: null as number | null,
        count,
        unlimited: true,
        remaining: null as number | null,
        paymentGated: false,
      };
    }

    // Gateway mode: no hard plan cap; learner pays per import (or uses free pool).
    const count = await this.prisma.userImport.count({ where: { userId } });
    return {
      limit: null as number | null,
      count,
      unlimited: false,
      remaining: null as number | null,
      paymentGated: true,
    };
  }

  async assertImportAllowed(userId: string) {
    // Plan-count gate only when gateway is off and unlimited flags are false.
    // With gateway on, ImportCommerceService.consumePayment enforces payment.
    if (this.paymentGatewayEnforcesImports()) return;

    const quota = await this.getImportQuota(userId);
    if (quota.unlimited || quota.limit == null) return;
    if (quota.count >= quota.limit) {
      throw new ForbiddenException(
        `Import limit reached (${quota.limit}). Upgrade to Premium for more.`,
      );
    }
  }

  async assertQuizAllowed(userId: string) {
    const plan = await this.getActivePlan(userId);
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: AI_SETTING_KEYS.defaultUserQuota },
    });
    const platformDefault = coerceNonNegInt(
      row?.value,
      defaultAiPlatformSettings().defaultUserQuota,
    );
    void platformDefault;
    const quota = planLimits(plan?.tier).quizzesPerDay; // Free 10 / Plus 200 (config)
    if (quota <= 0) return;
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
