import { Injectable, ForbiddenException } from '@nestjs/common';
import { PLUS_FAIR_USE_DEFAULTS, PLUS_FAIR_USE_KEYS, activeSubWhere, fairUseCap } from '../common/plan-active';
import { PrismaService } from '../prisma/prisma.service';
import { assertUnderCap, capOf, dailyLimitException, getPlanCaps, usageDayStart, userCapPlan } from '../common/plan-caps';
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
      where: { userId, ...activeSubWhere() },
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

  /** Quizzes/day from the plan's quiz_daily_quota (Free 10, Plus 200), runtime DB config cached ≤ 60 s. */
  async assertQuizAllowed(userId: string) {
    const [caps, plan] = await Promise.all([getPlanCaps(this.prisma), userCapPlan(this.prisma, userId)]);
    const usage = await this.prisma.aiUsageDaily.findUnique({
      where: { userId_usageDate: { userId, usageDate: usageDayStart() } },
    });
    assertUnderCap('quizzes', plan, caps, usage?.quizCount ?? 0);
  }

  async incrementQuizUsage(userId: string) {
    const today = usageDayStart(); // Tashkent calendar day (resets 00:00 Asia/Tashkent)
    await this.prisma.aiUsageDaily.upsert({
      where: { userId_usageDate: { userId, usageDate: today } },
      create: { userId, usageDate: today, quizCount: 1 },
      update: { quizCount: { increment: 1 } },
    });
  }
  /**
   * PAY2-04: atomic check-and-increment. Ensures today's row exists, then a single conditional
   * `UPDATE … SET quiz_count = quiz_count + 1 WHERE quiz_count < cap` claims a slot; concurrent requests
   * serialise on the row so the cap can never be exceeded. 0 rows → the 429 daily-limit error.
   * Call releaseQuizSlot() if the quiz is not delivered (generation failed / no questions).
   */
  async reserveQuizSlot(userId: string) {
    const [caps, plan] = await Promise.all([getPlanCaps(this.prisma), userCapPlan(this.prisma, userId)]);
    const usageDate = usageDayStart();
    const where = { userId_usageDate: { userId, usageDate } };
    // ON CONFLICT DO NOTHING: parallel first-of-day requests can't collide on the (user, date) key.
    await this.prisma.aiUsageDaily.createMany({ data: [{ userId, usageDate, quizCount: 0 }], skipDuplicates: true });
    const cap = capOf(caps, plan, 'quizzes');
    if (!cap) {
      await this.prisma.aiUsageDaily.update({ where, data: { quizCount: { increment: 1 } } });
      return;
    }
    const { count } = await this.prisma.aiUsageDaily.updateMany({
      where: { userId, usageDate, quizCount: { lt: cap } },
      data: { quizCount: { increment: 1 } },
    });
    if (count === 0) throw dailyLimitException('quizzes', plan, caps);
  }

  /**
   * Claim up to `n` Mashq questions for today. Plus (null cap) always gets `n`.
   * Free gets only the room left under the cap, so two tabs cannot pass 20.
   * Release the unused part if fewer questions are actually served.
   */
  async reserveMashq(userId: string, n: number): Promise<number> {
    if (n <= 0) return 0;
    const [caps, plan] = await Promise.all([getPlanCaps(this.prisma), userCapPlan(this.prisma, userId)]);
    const usageDate = usageDayStart();
    const where = { userId_usageDate: { userId, usageDate } };
    await this.prisma.aiUsageDaily.createMany({ data: [{ userId, usageDate, mashqQuestionCount: 0 }], skipDuplicates: true });
    const cap = capOf(caps, plan, 'mashq');
    if (cap == null) {
      await this.prisma.aiUsageDaily.update({ where, data: { mashqQuestionCount: { increment: n } } });
      return n;
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      const row = await this.prisma.aiUsageDaily.findUnique({ where });
      const used = row?.mashqQuestionCount ?? 0;
      const room = cap - used;
      if (room <= 0) throw dailyLimitException('mashq', plan, caps);
      const grant = Math.min(n, room);
      const { count } = await this.prisma.aiUsageDaily.updateMany({
        where: { userId, usageDate, mashqQuestionCount: used },
        data: { mashqQuestionCount: { increment: grant } },
      });
      if (count === 1) return grant;
    }
    throw dailyLimitException('mashq', plan, caps);
  }

  async releaseMashq(userId: string, n: number) {
    if (n <= 0) return;
    const usageDate = usageDayStart();
    await this.prisma.$executeRaw`
      UPDATE ai_usage_daily
      SET mashq_question_count = GREATEST(0, mashq_question_count - ${n})
      WHERE user_id = ${userId}::uuid AND usage_date = ${usageDate}
    `.catch(() => undefined);
  }

  /** PAY2-04: give back a reserved slot (never below 0). */
  async releaseQuizSlot(userId: string) {
    await this.prisma.aiUsageDaily.updateMany({
      where: { userId, usageDate: usageDayStart(), quizCount: { gt: 0 } },
      data: { quizCount: { decrement: 1 } },
    }).catch(() => undefined);
  }
}
