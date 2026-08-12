import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AchievementCategory,
  AppLanguage,
  CampaignChannel,
  CampaignStatus,
  ContentSource,
  ContentType,
  LicenseStatus,
  ModerationStatus,
  PublishStatus,
  SubscriptionTier,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { tokenizeText, slugify, uniqueWordCount } from '../../utils/tokenizer';
import {
  ADMIN_METRICS_KEY,
  FIGMA_ADMIN_METRICS,
  FigmaAdminMetrics,
} from './admin-figma-metrics';
import {
  AI_SETTING_KEYS,
  defaultAiPlatformSettings,
  parseAiPlatformSettings,
} from '../ai/ai-settings';
import { AuthService } from '../auth/auth.service';
import { UpdateAdminProfileDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  private async getMetrics(): Promise<FigmaAdminMetrics> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: ADMIN_METRICS_KEY } });
    if (row?.value && typeof row.value === 'object') {
      return { ...FIGMA_ADMIN_METRICS, ...(row.value as object) } as FigmaAdminMetrics;
    }
    return FIGMA_ADMIN_METRICS;
  }

  async dashboard() {
    const now = new Date();
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(dayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(dayStart);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(monthStart.getTime() - 1);
    const months = this.lastNMonths(6);

    const aiSettings = await this.resolveAiSettings();

    const [
      users,
      createdThisWeek,
      createdPrevWeek,
      activeSubscribers,
      activeTodayRows,
      publishedContent,
      userImports,
      moderationPending,
      ingestionQueued,
      aiTodayAgg,
      activeSubs,
      contentRevMonth,
      contentRevPrevMonth,
      contentRevToday,
      recentUsersRaw,
      recentPublished,
      recentTickets,
      contentPurchasesSince,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({
        where: { deletedAt: null, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      this.prisma.userSubscription.count({
        where: { status: { in: ['active', 'trialing'] }, plan: { tier: 'premium' } },
      }),
      this.prisma.readingSession.findMany({
        where: { startedAt: { gte: dayStart } },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.contentItem.count({ where: { publishStatus: PublishStatus.published } }),
      this.prisma.userImport.count(),
      this.prisma.moderationQueue.count({ where: { status: 'pending' } }),
      this.prisma.ingestionJob.count({ where: { status: 'queued' } }),
      this.prisma.aiUsageDaily.aggregate({
        where: { usageDate: { gte: dayStart } },
        _sum: { lookupCount: true, quizCount: true, tokensUsed: true },
      }),
      this.prisma.userSubscription.findMany({
        where: { status: { in: ['active', 'trialing'] }, plan: { tier: 'premium' } },
        include: { plan: true },
      }),
      this.prisma.contentPurchase.aggregate({
        where: { status: 'completed', createdAt: { gte: monthStart } },
        _sum: { amountUsd: true },
      }),
      this.prisma.contentPurchase.aggregate({
        where: { status: 'completed', createdAt: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { amountUsd: true },
      }),
      this.prisma.contentPurchase.aggregate({
        where: { status: 'completed', createdAt: { gte: dayStart } },
        _sum: { amountUsd: true },
      }),
      this.prisma.user.findMany({
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: {
          targetLanguages: true,
          subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      }),
      this.prisma.contentItem.findMany({
        where: { publishStatus: PublishStatus.published, publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: 3,
        select: {
          id: true,
          title: true,
          cefrLevel: true,
          language: true,
          publishedAt: true,
        },
      }),
      this.prisma.supportTicket.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { id: true, subject: true, createdAt: true },
      }),
      this.prisma.contentPurchase.findMany({
        where: {
          status: 'completed',
          createdAt: { gte: new Date(dayStart.getTime() - 6 * 86_400_000) },
        },
        select: { amountUsd: true, createdAt: true },
      }),
    ]);

    const activeToday = activeTodayRows.length;
    const mrr = activeSubs.reduce((sum, s) => sum + Number(s.plan.priceMonthly ?? 0), 0);
    const revenueMonthUsd = Number(contentRevMonth._sum.amountUsd ?? 0);
    const revenuePrevUsd = Number(contentRevPrevMonth._sum.amountUsd ?? 0);
    const revenueToday = Number(contentRevToday._sum.amountUsd ?? 0);
    const revenueMomDelta = Number((revenueMonthUsd - revenuePrevUsd).toFixed(2));
    const mrrGrowthPct =
      revenuePrevUsd > 0
        ? Number((((revenueMonthUsd - revenuePrevUsd) / revenuePrevUsd) * 100).toFixed(1))
        : revenueMonthUsd > 0
          ? 100
          : 0;
    const userGrowthPct =
      createdPrevWeek > 0
        ? Number((((createdThisWeek - createdPrevWeek) / createdPrevWeek) * 100).toFixed(1))
        : createdThisWeek > 0
          ? 100
          : 0;
    const conversionPct =
      users > 0 ? Number(((activeSubscribers / users) * 100).toFixed(1)) : 0;
    const engagementPct = users > 0 ? Number(((activeToday / users) * 100).toFixed(1)) : 0;

    const aiLookupsToday = aiTodayAgg._sum.lookupCount ?? 0;
    const aiQuizzesToday = aiTodayAgg._sum.quizCount ?? 0;
    const aiTokensToday = Number(aiTodayAgg._sum.tokensUsed ?? 0);
    const aiLimit = aiSettings.dailyLimit;
    const aiUsagePct =
      aiLimit > 0 ? Number(Math.min(100, (aiLookupsToday / aiLimit) * 100).toFixed(1)) : 0;

    const userGrowth = await Promise.all(
      months.map(async (m) => ({
        month: m.label,
        users: await this.prisma.user.count({
          where: { deletedAt: null, createdAt: { lte: m.end } },
        }),
      })),
    );

    const revenueTrend = await Promise.all(
      months.map(async (m) => {
        const [subs, purchases] = await Promise.all([
          this.prisma.userSubscription.findMany({
            where: {
              status: { in: ['active', 'trialing'] },
              plan: { tier: 'premium' },
              createdAt: { lte: m.end },
            },
            include: { plan: true },
          }),
          this.prisma.contentPurchase.aggregate({
            where: {
              status: 'completed',
              createdAt: { gte: m.start, lte: m.end },
            },
            _sum: { amountUsd: true },
          }),
        ]);
        const mrrAt = subs.reduce((sum, s) => sum + Number(s.plan.priceMonthly ?? 0), 0);
        const purchaseUsd = Number(purchases._sum.amountUsd ?? 0);
        return { month: m.label, mrr: Number((mrrAt + purchaseUsd).toFixed(2)), users: 0 };
      }),
    );

    const revenueDailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dayStart);
      d.setDate(d.getDate() - i);
      revenueDailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const p of contentPurchasesSince) {
      const key = p.createdAt.toISOString().slice(0, 10);
      if (revenueDailyMap.has(key)) {
        revenueDailyMap.set(key, (revenueDailyMap.get(key) ?? 0) + Number(p.amountUsd));
      }
    }

    const revenueDaily = [...revenueDailyMap.entries()].map(([date, amount]) => ({
      month: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      day: date,
      mrr: Number(amount.toFixed(2)),
      users: 0,
    }));

    const recentUsers = recentUsersRaw.map((u) => {
      const mapped = this.mapUserRow(u);
      return {
        id: mapped.id,
        displayName: mapped.displayName,
        email: mapped.email,
        targetLanguage: mapped.targetLanguage,
        billingTier: mapped.billingTier,
        createdAt: mapped.createdAt,
      };
    });

    type ActivityItem = {
      id: string;
      type: 'user' | 'content' | 'support';
      title: string;
      subtitle: string;
      createdAt: string;
      href?: string;
    };
    const activity: ActivityItem[] = [];
    for (const u of recentUsersRaw.slice(0, 3)) {
      const mapped = this.mapUserRow(u);
      activity.push({
        id: `user:${u.id}`,
        type: 'user',
        title: 'New user registered',
        subtitle: `${mapped.displayName || mapped.email} - ${mapped.billingTier}`,
        createdAt: u.createdAt.toISOString(),
        href: `/users`,
      });
    }
    for (const c of recentPublished) {
      activity.push({
        id: `content:${c.id}`,
        type: 'content',
        title: 'Content published',
        subtitle: `"${c.title}" ${(c.cefrLevel ?? '').toUpperCase()} ${this.langLabel(c.language)}`,
        createdAt: (c.publishedAt ?? now).toISOString(),
        href: `/content`,
      });
    }
    for (const t of recentTickets) {
      activity.push({
        id: `ticket:${t.id}`,
        type: 'support',
        title: 'New support ticket',
        subtitle: t.subject,
        createdAt: t.createdAt.toISOString(),
        href: `/support`,
      });
    }
    activity.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    const recentActivity = activity.slice(0, 5);

    const importPaidMonth = await this.prisma.importPayment
      .aggregate({
        where: { status: 'paid', paidAt: { gte: monthStart } },
        _sum: { amountTiyins: true },
      })
      .catch(() => ({ _sum: { amountTiyins: 0 as number | null } }));
    const importRevenueUzs = Math.round((importPaidMonth._sum.amountTiyins ?? 0) / 100);

    return {
      users,
      publishedContent,
      userImports,
      moderationPending,
      ingestionQueued,
      activeSubscribers,
      activeToday,
      engagementPct,
      mrr: Number(mrr.toFixed(2)),
      mrrGrowthPct,
      aiLookupsToday,
      aiLimit,
      aiUsagePct,
      userGrowthPct,
      conversionPct,
      revenueToday: Number(revenueToday.toFixed(2)),
      revenueMomDelta,
      aiUsageTotal: {
        tokensUsed: aiTokensToday || aiLookupsToday * 32,
        lookupCount: aiLookupsToday,
        quizCount: aiQuizzesToday,
      },
      userGrowth,
      revenueTrend,
      revenueDaily,
      // No reliable lemma-category / phrase leaderboard yet — clients should hide empty.
      aiCategories: [] as Array<{ name: string; pct: number; color: string }>,
      topPhrases: [] as Array<{
        phrase: string;
        language: string;
        level: string;
        lookups: number;
        aiMatch: number;
      }>,
      contentByLevel: [],
      recentUsers,
      recentActivity,
      // Separate currencies — never mix UZS imports into USD MRR.
      revenueCurrency: 'USD',
      importCurrency: 'UZS',
      importRevenueUzs,
    };
  }

  async listUsers(q?: string, tier?: string, status?: string) {
    const statusKey = (status ?? '').trim().toLowerCase();
    const includeSuspended = statusKey === 'suspended';
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(dayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [aiSettings, usageToday, activeRecentRows] = await Promise.all([
      this.resolveAiSettings(),
      this.prisma.aiUsageDaily.findMany({
        where: { usageDate: { gte: dayStart } },
        include: {
          user: {
            include: {
              subscriptions: {
                where: { status: { in: ['active', 'trialing'] } },
                include: { plan: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      }),
      this.prisma.readingSession.findMany({
        where: { startedAt: { gte: weekAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const flaggedIds = new Set<string>();
    for (const r of usageToday) {
      const quota =
        r.user.subscriptions[0]?.plan.aiDailyQuota ?? aiSettings.defaultUserQuota;
      if (quota < 1_000_000 && r.lookupCount >= Math.max(1, Math.floor(quota * 0.9))) {
        flaggedIds.add(r.userId);
      }
    }
    const activeRecentIds = new Set(activeRecentRows.map((r) => r.userId));

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: includeSuspended ? { not: null } : null,
        ...(q
          ? {
              OR: [
                { email: { contains: q, mode: 'insensitive' } },
                { displayName: { contains: q, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        targetLanguages: true,
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        adminProfile: true,
        _count: { select: { vocabulary: true, readingSessions: true } },
      },
    });

    let rows = users.map((u) => {
      const mapped = this.mapUserRow(u);
      const isFlagged = flaggedIds.has(u.id);
      const isSuspended = Boolean(u.deletedAt);
      return {
        ...mapped,
        planLabel: mapped.billingTier === 'Premium' ? 'Premium' : 'Free Tier',
        isAdmin: Boolean(u.adminProfile),
        adminRole: u.adminProfile?.role ?? null,
        vocabCount: u._count.vocabulary,
        sessionCount: u._count.readingSessions,
        isFlagged,
        isSuspended,
        isActiveRecently: activeRecentIds.has(u.id) && !isSuspended,
      };
    });

    if (tier) {
      rows = rows.filter((r) => r.billingTier.toLowerCase().includes(tier.toLowerCase()));
    }
    if (statusKey === 'flagged') {
      rows = rows.filter((r) => r.isFlagged);
    }

    const [total, premium, suspended] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.userSubscription.count({
        where: { status: { in: ['active', 'trialing'] }, plan: { tier: 'premium' } },
      }),
      this.prisma.user.count({ where: { deletedAt: { not: null } } }),
    ]);

    return {
      stats: {
        total,
        premium,
        free: Math.max(0, total - premium),
        suspended,
        flagged: flaggedIds.size,
      },
      users: rows,
    };
  }

  async getUser(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        targetLanguages: true,
        subscriptions: { include: { plan: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        adminProfile: true,
        _count: { select: { vocabulary: true, readingSessions: true } },
      },
    });
    if (!u) throw new NotFoundException('User not found');

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(dayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [usageToday, recentSessions, recentVocab, recentImports, aiSettings] = await Promise.all([
      this.prisma.aiUsageDaily.findFirst({
        where: { userId: id, usageDate: { gte: dayStart } },
      }),
      this.prisma.readingSession.findMany({
        where: { userId: id },
        orderBy: { startedAt: 'desc' },
        take: 8,
        include: { content: { select: { title: true } } },
      }),
      this.prisma.userVocabulary.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { lemma: true, sourceLang: true, createdAt: true },
      }),
      this.prisma.userImport.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { title: true, createdAt: true },
      }),
      this.resolveAiSettings(),
    ]);

    const quota =
      u.subscriptions[0]?.plan.aiDailyQuota ?? aiSettings.defaultUserQuota;
    const isFlagged =
      Boolean(usageToday) &&
      quota < 1_000_000 &&
      (usageToday?.lookupCount ?? 0) >= Math.max(1, Math.floor(quota * 0.9));
    const isSuspended = Boolean(u.deletedAt);
    const recentRead = await this.prisma.readingSession.findFirst({
      where: { userId: id, startedAt: { gte: weekAgo } },
      select: { id: true },
    });

    const mapped = this.mapUserRow(u);
    const activity: Array<{ id: string; label: string; createdAt: string; type: string }> = [];

    for (const s of recentSessions) {
      const title = s.content?.title?.trim() || 'a story';
      activity.push({
        id: `session:${s.id}`,
        type: 'reading',
        label: `Read ${title}`,
        createdAt: s.startedAt.toISOString(),
      });
    }

    // Collapse vocab saves in the same calendar hour into one row.
    const vocabBuckets = new Map<string, { count: number; lang: string; at: Date }>();
    for (const v of recentVocab) {
      const hourKey = v.createdAt.toISOString().slice(0, 13);
      const prev = vocabBuckets.get(hourKey);
      if (prev) {
        prev.count += 1;
      } else {
        vocabBuckets.set(hourKey, {
          count: 1,
          lang: this.langLabel(v.sourceLang),
          at: v.createdAt,
        });
      }
    }
    for (const [key, b] of vocabBuckets) {
      activity.push({
        id: `vocab:${key}`,
        type: 'vocabulary',
        label:
          b.count === 1
            ? `Saved a ${b.lang} word`
            : `Learned ${b.count} new ${b.lang} words`,
        createdAt: b.at.toISOString(),
      });
    }

    for (const imp of recentImports) {
      activity.push({
        id: `import:${imp.title}:${imp.createdAt.toISOString()}`,
        type: 'import',
        label: `Imported ${imp.title}`,
        createdAt: imp.createdAt.toISOString(),
      });
    }

    const sub = u.subscriptions[0];
    if (sub) {
      activity.push({
        id: `sub:${sub.id}`,
        type: 'subscription',
        label:
          sub.plan.tier === 'premium'
            ? 'Subscribed to Premium plan'
            : 'On Free plan',
        createdAt: sub.createdAt.toISOString(),
      });
    }

    activity.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return {
      ...mapped,
      planLabel: mapped.billingTier === 'Premium' ? 'Premium' : 'Free Tier',
      isAdmin: Boolean(u.adminProfile),
      adminRole: u.adminProfile?.role ?? null,
      vocabCount: u._count.vocabulary,
      sessionCount: u._count.readingSessions,
      isFlagged,
      isSuspended,
      isActiveRecently: Boolean(recentRead) && !isSuspended,
      recentActivity: activity.slice(0, 8),
    };
  }

  async updateUser(
    id: string,
    body: { displayName?: string; deleted?: boolean; tier?: string },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');

    if (body.deleted === true && user.adminProfile) {
      throw new BadRequestException('Admin accounts cannot be suspended here.');
    }

    if (body.displayName !== undefined || body.deleted !== undefined) {
      await this.prisma.user.update({
        where: { id },
        data: {
          displayName: body.displayName,
          deletedAt:
            body.deleted === true ? new Date() : body.deleted === false ? null : undefined,
        },
      });
    }

    if (body.tier !== undefined) {
      await this.adjustUserTier(id, body.tier);
    }

    return this.getUser(id);
  }

  async adjustUserTier(id: string, tierRaw: string) {
    const tierKey = tierRaw.trim().toLowerCase();
    if (tierKey !== 'free' && tierKey !== 'premium') {
      throw new BadRequestException('tier must be "free" or "premium"');
    }
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.adminProfile) {
      throw new BadRequestException('Cannot adjust tier for admin accounts.');
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { tier: tierKey as SubscriptionTier },
    });
    if (!plan) throw new NotFoundException(`Plan "${tierKey}" not found`);

    const existing = await this.prisma.userSubscription.findFirst({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await this.prisma.userSubscription.update({
        where: { id: existing.id },
        data: {
          planId: plan.id,
          status: 'active',
          currentPeriodEnd:
            tierKey === 'premium'
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : null,
        },
      });
    } else {
      await this.prisma.userSubscription.create({
        data: {
          userId: id,
          planId: plan.id,
          status: 'active',
          currentPeriodEnd:
            tierKey === 'premium'
              ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
              : null,
          provider: 'admin',
        },
      });
    }

    return this.getUser(id);
  }

  async resetUserPassword(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.adminProfile) {
      throw new BadRequestException('Cannot reset password for admin accounts here.');
    }
    return this.auth.adminTriggerPasswordReset(id);
  }

  async hardDeleteUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.adminProfile) {
      throw new BadRequestException('Admin accounts cannot be permanently deleted here.');
    }
    await this.prisma.user.delete({ where: { id } });
    return { deleted: true, id };
  }

  listContent(status?: PublishStatus) {
    return this.prisma.contentItem.findMany({
      where: status ? { publishStatus: status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: { license: true, _count: { select: { readingProgress: true, segments: true } } },
    });
  }

  async contentStats() {
    // Keep Figma-sized KPI numbers for the Content Library header cards.
    const metrics = await this.getMetrics();
    const c = metrics.content;
    const freeItemsDb = await this.prisma.contentItem.count({ where: { isFree: true } });
    return {
      total: c.total,
      published: c.published,
      draft: c.draft,
      review: c.review,
      archived: c.archived ?? 0,
      activeSalesMonthly: c.activeSalesMonthly ?? 12450,
      freeItems: Math.max(c.freeItems ?? 0, freeItemsDb),
    };
  }

  /** Real ContentItem rows for the admin Content Library (Publish/Archive use these IDs). */
  async listCurriculum(type?: string) {
    // User Imports tab is ops UI (moderation/ingestion/licenses); no curriculum rows.
    if (type === 'user_imports') return [];

    const where =
      !type || type === 'all'
        ? undefined
        : { contentType: type as ContentType };

    const items = await this.prisma.contentItem.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        readingProgress: { select: { progressPct: true } },
        _count: { select: { readingProgress: true } },
      },
    });

    return items.map((item) => {
      const reads = item.readingProgress;
      const completion =
        reads.length === 0
          ? 0
          : Math.round(reads.reduce((sum, r) => sum + r.progressPct, 0) / reads.length);
      return {
        id: item.id,
        title: item.title,
        language: item.language,
        cefrLevel: item.cefrLevel,
        contentType: item.contentType,
        wordCount: item.wordCount,
        activeReads: item._count.readingProgress,
        completion,
        publishStatus: item.publishStatus,
        isFree: item.isFree,
        priceUsd: Number(item.priceUsd ?? 0),
        salesCount: item.salesCount,
      };
    });
  }

  private parseContentPricing(body: Record<string, unknown>) {
    const isFree = body.isFree === true || body.isFree === 'true' || body.pricing === 'free';
    const rawPrice = body.priceUsd ?? body.price;
    const priceUsd = isFree ? 0 : Number(rawPrice ?? 0);
    return {
      isFree,
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : 0,
    };
  }

  async createContent(adminId: string, body: Record<string, unknown>) {
    const title = String(body.title ?? 'Untitled');
    const plainText = String(body.plainText ?? '');
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(plainText);
    const pricing = this.parseContentPricing(body);

    return this.prisma.contentItem.create({
      data: {
        slug: `${slugify(title)}-${Date.now()}`,
        title,
        description: body.description ? String(body.description) : undefined,
        language: (body.language as never) ?? 'en',
        contentType: (body.contentType as ContentType) ?? ContentType.article,
        contentSource: (body.contentSource as ContentSource) ?? ContentSource.public_domain,
        cefrLevel: (body.cefrLevel as never) ?? 'b1',
        genre: body.genre ? String(body.genre) : undefined,
        licenseId: body.licenseId ? String(body.licenseId) : undefined,
        isFree: pricing.isFree,
        priceUsd: pricing.priceUsd,
        wordCount,
        uniqueWordCount: uniqueWordCount(tokenMap as never),
        publishStatus: PublishStatus.draft,
        createdById: adminId,
        segments: plainText
          ? {
              create: {
                segmentIndex: 0,
                title: 'Chapter 1',
                plainText,
                tokenMap: tokenMap as never,
                sentenceMap: sentenceMap as never,
                wordCount,
              },
            }
          : undefined,
      },
      include: { segments: true, license: true },
    });
  }

  async updateContent(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content not found');

    const pricing =
      body.isFree !== undefined || body.priceUsd !== undefined || body.price !== undefined || body.pricing !== undefined
        ? this.parseContentPricing({
            isFree: body.isFree ?? existing.isFree,
            priceUsd: body.priceUsd ?? body.price ?? existing.priceUsd,
            pricing: body.pricing,
          })
        : null;

    return this.prisma.contentItem.update({
      where: { id },
      data: {
        title: body.title !== undefined ? String(body.title) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        language: body.language !== undefined ? (body.language as never) : undefined,
        contentType: body.contentType !== undefined ? (body.contentType as ContentType) : undefined,
        cefrLevel: body.cefrLevel !== undefined ? (body.cefrLevel as never) : undefined,
        publishStatus: body.publishStatus !== undefined ? (body.publishStatus as PublishStatus) : undefined,
        isFree: pricing?.isFree,
        priceUsd: pricing?.priceUsd,
        salesCount: body.salesCount !== undefined ? Number(body.salesCount) : undefined,
      },
    });
  }

  async getCatalogPricingRules() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'catalogPricingRules' } });
    const defaults = {
      contentType: 'book',
      basePriceUsd: 4.99,
      perPageSurchargeUsd: 0.02,
      volumeDiscountsEnabled: true,
      buy3PctOff: 10,
      buy5PctOff: 20,
    };
    if (!row?.value || typeof row.value !== 'object') return defaults;
    return { ...defaults, ...(row.value as object) };
  }

  async updateCatalogPricingRules(body: Record<string, unknown>) {
    const current = await this.getCatalogPricingRules();
    const next = {
      ...current,
      contentType: body.contentType !== undefined ? String(body.contentType) : current.contentType,
      basePriceUsd: body.basePriceUsd !== undefined ? Number(body.basePriceUsd) : current.basePriceUsd,
      perPageSurchargeUsd:
        body.perPageSurchargeUsd !== undefined ? Number(body.perPageSurchargeUsd) : current.perPageSurchargeUsd,
      volumeDiscountsEnabled:
        body.volumeDiscountsEnabled !== undefined
          ? Boolean(body.volumeDiscountsEnabled)
          : current.volumeDiscountsEnabled,
      buy3PctOff: body.buy3PctOff !== undefined ? Number(body.buy3PctOff) : current.buy3PctOff,
      buy5PctOff: body.buy5PctOff !== undefined ? Number(body.buy5PctOff) : current.buy5PctOff,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: 'catalogPricingRules' },
      update: { value: next as never },
      create: { key: 'catalogPricingRules', value: next as never },
    });
    return next;
  }

  publishContent(id: string) {
    return this.prisma.contentItem.update({
      where: { id },
      data: { publishStatus: PublishStatus.published, publishedAt: new Date() },
    });
  }

  archiveContent(id: string) {
    return this.prisma.contentItem.update({
      where: { id },
      data: { publishStatus: PublishStatus.archived },
    });
  }

  async importPricing(range = '12m') {
    const metrics = await this.getMetrics();
    const m = metrics.importPricing;
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));

    const [rules, tiers, freeLimits, importCount, paidMonth, freeMonth, importsToday] = await Promise.all([
      this.prisma.importPricingRule.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.importPageTier.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.getImportFreeLimits(),
      this.prisma.userImport.count(),
      this.prisma.importPayment.aggregate({
        where: { status: 'paid', amountTiyins: { gt: 0 }, paidAt: { gte: monthStart } },
        _sum: { amountTiyins: true },
        _count: true,
      }).catch(() => ({ _sum: { amountTiyins: 0 }, _count: 0 })),
      this.prisma.importPayment.count({
        where: { status: 'paid', amountTiyins: 0, paidAt: { gte: monthStart } },
      }).catch(() => 0),
      this.prisma.userImport.count({ where: { createdAt: { gte: dayStart } } }),
    ]);

    const revenueUzs = (paidMonth._sum.amountTiyins ?? 0) / 100;
    const freePool = Math.max(1, freeLimits.dailyFreeImportsPerUser * 30);
    const freeUsed = freeMonth;

    return {
      range,
      currency: 'UZS',
      atmosConfigured: Boolean(
        process.env.ATMOS_CONSUMER_KEY && process.env.ATMOS_STORE_ID,
      ),
      paymentGatewayEnabled: ['true', '1', 'yes', 'on'].includes(
        (process.env.PAYMENT_GATEWAY_ENABLED ?? '').trim().toLowerCase(),
      ),
      stats: {
        // Prefer live DB aggregates (incl. 0) — do not fall back to Figma seed metrics.
        totalImportsToday: importsToday,
        importsGrowthPct: m.importsGrowthPct,
        revenueFromImports: revenueUzs,
        revenueGrowthPct: m.revenueGrowthPct,
        freeImportsUsed: freeUsed,
        freeImportsPool: freePool,
        freeUsedPct: Math.round((freeUsed / freePool) * 100),
        conversionPct: m.conversionPct,
        conversionGrowthPct: m.conversionGrowthPct,
        realImportCount: importCount,
        paidImportsThisMonth: paidMonth._count,
      },
      rules: rules.map((r) => ({
        id: r.id,
        key: r.key,
        label: r.label,
        pricePerImport: Number(r.pricePerImport),
        pricePerPage: Number(r.pricePerPage),
        isActive: r.isActive,
        sortOrder: r.sortOrder,
      })),
      tiers: tiers.map((t) => ({
        id: t.id,
        label: t.label,
        minPages: t.minPages,
        maxPages: t.maxPages,
        priceUsd: Number(t.priceUsd),
        priceUzs: Number(t.priceUsd),
        sortOrder: t.sortOrder,
      })),
      freeLimits,
    };
  }

  async updateImportPricingRules(body: { rules?: Array<Record<string, unknown>> }) {
    const rules = body.rules ?? [];
    await Promise.all(
      rules.map((rule) =>
        this.prisma.importPricingRule.update({
          where: { id: String(rule.id) },
          data: {
            pricePerImport: rule.pricePerImport !== undefined ? Number(rule.pricePerImport) : undefined,
            pricePerPage: rule.pricePerPage !== undefined ? Number(rule.pricePerPage) : undefined,
            isActive: rule.isActive !== undefined ? Boolean(rule.isActive) : undefined,
            label: rule.label !== undefined ? String(rule.label) : undefined,
          },
        }),
      ),
    );
    return this.importPricing();
  }

  async updateImportPageTier(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.importPageTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page tier not found');
    return this.prisma.importPageTier.update({
      where: { id },
      data: {
        label: body.label !== undefined ? String(body.label) : undefined,
        minPages: body.minPages !== undefined ? Number(body.minPages) : undefined,
        maxPages: body.maxPages === null ? null : body.maxPages !== undefined ? Number(body.maxPages) : undefined,
        priceUsd:
          body.priceUzs !== undefined
            ? Number(body.priceUzs)
            : body.priceUsd !== undefined
              ? Number(body.priceUsd)
              : undefined,
      },
    });
  }

  async getImportFreeLimits() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } });
    const defaults = {
      dailyFreeImportsPerUser: 3,
      monthlyFreePageLimit: 50,
      allowedFormats: ['article', 'news'] as string[],
      resetCycle: 'monthly',
      allowRollover: true,
    };
    if (!row?.value || typeof row.value !== 'object') return defaults;
    return { ...defaults, ...(row.value as object) };
  }

  async updateImportFreeLimits(body: Record<string, unknown>) {
    const current = await this.getImportFreeLimits();
    const next = {
      ...current,
      dailyFreeImportsPerUser:
        body.dailyFreeImportsPerUser !== undefined
          ? Number(body.dailyFreeImportsPerUser)
          : current.dailyFreeImportsPerUser,
      monthlyFreePageLimit:
        body.monthlyFreePageLimit !== undefined ? Number(body.monthlyFreePageLimit) : current.monthlyFreePageLimit,
      allowedFormats: Array.isArray(body.allowedFormats)
        ? body.allowedFormats.map(String)
        : current.allowedFormats,
      resetCycle: body.resetCycle !== undefined ? String(body.resetCycle) : current.resetCycle,
      allowRollover: body.allowRollover !== undefined ? Boolean(body.allowRollover) : current.allowRollover,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: 'importFreeLimits' },
      update: { value: next as never },
      create: { key: 'importFreeLimits', value: next as never },
    });
    return next;
  }

  listLicenses(status?: LicenseStatus) {
    return this.prisma.license.findMany({
      where: status ? { status } : undefined,
      orderBy: { updatedAt: 'desc' },
    });
  }

  createLicense(adminId: string, body: Record<string, unknown>) {
    return this.prisma.license.create({
      data: {
        rightsHolder: String(body.rightsHolder ?? 'Unknown'),
        contractRef: body.contractRef ? String(body.contractRef) : undefined,
        status: (body.status as LicenseStatus) ?? LicenseStatus.pending,
        territories: (body.territories as string[]) ?? ['GLOBAL'],
        attributionText: String(body.attributionText ?? 'All rights reserved.'),
        royaltyNotes: body.royaltyNotes ? String(body.royaltyNotes) : undefined,
        createdById: adminId,
      },
    });
  }

  listModeration(status: ModerationStatus) {
    return this.prisma.moderationQueue.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: { import: true, content: true },
    });
  }

  async reviewModeration(reviewerId: string, id: string, status: ModerationStatus, notes?: string) {
    const item = await this.prisma.moderationQueue.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Moderation item not found');

    const updated = await this.prisma.moderationQueue.update({
      where: { id },
      data: {
        status,
        notes,
        reviewerId,
        reviewedAt: new Date(),
      },
    });

    // Flip the underlying content's publish state so the review decision actually takes
    // effect end-to-end (previously this only updated the queue row itself — see
    // docs/E2E_AUDIT_REPORT.md's moderation-bypass finding).
    if (item.contentId) {
      if (status === ModerationStatus.approved) {
        await this.prisma.contentItem.update({
          where: { id: item.contentId },
          data: { publishStatus: PublishStatus.published, publishedAt: new Date() },
        });
      } else if (status === ModerationStatus.rejected) {
        await this.prisma.contentItem.update({
          where: { id: item.contentId },
          data: { publishStatus: PublishStatus.archived },
        });
      }
    }

    return updated;
  }

  listIngestionJobs() {
    return this.prisma.ingestionJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private analyticsRangeFactor(range?: string) {
    if (range === '7d') return 0.32;
    if (range === '90d') return 2.65;
    return 1;
  }

  private aiRangeFactor(range?: string) {
    if (range === 'yesterday') return 0.88;
    if (range === '7d') return 6.4;
    return 1;
  }

  async search(q?: string) {
    const query = (q ?? '').trim();
    if (!query) return { q: query, results: [] as Array<Record<string, unknown>> };

    const [users, content, tickets, campaigns, languages] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { displayName: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 6,
        orderBy: { createdAt: 'desc' },
        select: { id: true, email: true, displayName: true },
      }),
      this.prisma.contentItem.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { slug: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 6,
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, language: true, cefrLevel: true, contentType: true },
      }),
      this.prisma.supportTicket.findMany({
        where: {
          OR: [
            { subject: { contains: query, mode: 'insensitive' } },
            { body: { contains: query, mode: 'insensitive' } },
            { category: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, subject: true, status: true, priority: true },
      }),
      this.prisma.notificationCampaign.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { subject: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, name: true, subject: true, status: true, channel: true },
      }),
      this.prisma.languageCatalog.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { nativeName: { contains: query, mode: 'insensitive' } },
            { code: { contains: query, mode: 'insensitive' } },
          ],
        },
        take: 5,
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const billingHits =
      /bill|sub|premium|mrr|revenue|plan|import|pricing|limit/i.test(query)
        ? [
            {
              id: 'import-pricing',
              type: 'subscription' as const,
              title: 'Import & Pricing',
              subtitle: 'Import costs, free limits, and page tiers',
              href: '/import-pricing',
            },
          ]
        : [];

    const results = [
      ...users.map((u) => ({
        id: u.id,
        type: 'user' as const,
        title: u.displayName || u.email,
        subtitle: u.email,
        href: `/users?q=${encodeURIComponent(u.email)}`,
      })),
      ...content.map((c) => ({
        id: c.id,
        type: 'content' as const,
        title: c.title,
        subtitle: `${c.language.toUpperCase()} · ${c.cefrLevel.toUpperCase()} · ${c.contentType}`,
        href: `/content?q=${encodeURIComponent(c.title)}`,
      })),
      ...tickets.map((t) => ({
        id: t.id,
        type: 'ticket' as const,
        title: t.subject,
        subtitle: `${t.status} · ${t.priority}`,
        href: '/support',
      })),
      ...campaigns.map((c) => ({
        id: c.id,
        type: 'campaign' as const,
        title: c.name,
        subtitle: `${c.channel} · ${c.status} · ${c.subject}`,
        href: '/notifications',
      })),
      ...languages.map((l) => ({
        id: l.code,
        type: 'language' as const,
        title: l.name,
        subtitle: `${l.nativeName} · ${l.status}`,
        href: '/languages',
      })),
      ...billingHits,
    ];

    return { q: query, results };
  }

  async notificationsFeed() {
    const [campaigns, tickets] = await Promise.all([
      this.prisma.notificationCampaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.supportTicket.findMany({
        where: { status: { in: ['open', 'in_progress'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);

    const campaignItems = campaigns.map((c) => ({
      id: `campaign:${c.id}`,
      type: 'campaign' as const,
      title: c.name,
      body: c.subject || c.body,
      href: '/notifications',
      createdAt: (c.sentAt ?? c.scheduledAt ?? c.createdAt).toISOString(),
      severity: c.status === 'draft' ? ('info' as const) : ('info' as const),
    }));

    const ticketItems = tickets.map((t) => ({
      id: `ticket:${t.id}`,
      type: 'ticket' as const,
      title: t.subject,
      body: `${t.priority} priority · ${t.status.replace('_', ' ')}`,
      href: '/support',
      createdAt: t.createdAt.toISOString(),
      severity:
        t.priority === 'high' || t.priority === 'urgent'
          ? ('critical' as const)
          : t.priority === 'medium'
            ? ('warning' as const)
            : ('info' as const),
    }));

    const alertItems =
      tickets.some((t) => t.priority === 'high' || t.priority === 'urgent')
        ? [
            {
              id: 'alert:high-priority-tickets',
              type: 'alert' as const,
              title: 'High-priority support backlog',
              body: 'One or more high-priority tickets need triage.',
              href: '/support',
              createdAt: new Date().toISOString(),
              severity: 'warning' as const,
            },
          ]
        : [];

    const items = [...alertItems, ...ticketItems, ...campaignItems].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return { unreadCount: items.length, items: items.slice(0, 12) };
  }

  async subscriptions(range = '12m') {
    const metrics = await this.getMetrics();
    const s = metrics.subscriptions;
    const plans = await this.prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } });
    const months = range === '3m' ? 3 : range === '6m' ? 6 : 12;
    const revenueGrowth12m = s.revenueGrowth12m.slice(-months).map((p) => ({ ...p }));
    const latest = revenueGrowth12m.at(-1)?.mrr ?? s.mrr;
    const prev = revenueGrowth12m.at(-2)?.mrr ?? latest;
    const sliceFactor = latest / Math.max(s.mrr, 1);

    return {
      range,
      stats: {
        mrr: Math.round(s.mrr * (range === '12m' ? 1 : sliceFactor)),
        arr: Math.round(s.arr * (range === '12m' ? 1 : sliceFactor)),
        activePremium: s.activePremium,
        canceled: s.funnel.churned,
        churnPct: s.churnPct,
        churnDeltaPct: s.churnDeltaPct,
        arpu: s.arpu,
        arpuGrowthPct: s.arpuGrowthPct,
        arrGrowthPct: s.arrGrowthPct,
        mrrGrowthPct: Number((((latest - prev) / Math.max(prev, 1)) * 100).toFixed(1)),
      },
      planDistribution: s.planDistribution.map((p) => ({ ...p })),
      revenueGrowth12m,
      funnel: { ...s.funnel },
      transactions: s.transactions.map((t) => ({ ...t })),
      plans: plans.map((p) => ({
        ...p,
        priceMonthly: Number(p.priceMonthly ?? 0),
        subscriberCount:
          p.tier === 'free'
            ? s.freeUsers
            : p.tier === 'premium'
              ? s.activePremium
              : 0,
      })),
      subscriptions: s.transactions.map((t, i) => ({
        id: `txn-${i}`,
        status: t.status.toLowerCase(),
        provider: 'stripe',
        currentPeriodEnd: null,
        createdAt: t.date,
        plan: t.plan,
        tier: t.plan.toLowerCase().includes('yearly') ? 'premium' : t.plan.toLowerCase().includes('monthly') ? 'premium' : 'free',
        priceMonthly: t.amount,
        user: {
          id: `txn-user-${i}`,
          email: t.email,
          displayName: t.user,
        },
      })),
    };
  }

  private aiDateBounds(range = 'today') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    if (range === 'yesterday') {
      start.setDate(start.getDate() - 1);
      end.setTime(start.getTime());
      end.setHours(23, 59, 59, 999);
    } else if (range === '7d') {
      start.setDate(start.getDate() - 6);
    }
    return { start, end };
  }

  async aiUsage(range = 'today') {
    const aiSettings = await this.resolveAiSettings();
    const { start, end } = this.aiDateBounds(range);

    const rows = await this.prisma.aiUsageDaily.findMany({
      where: { usageDate: { gte: start, lte: end } },
      include: {
        user: {
          include: {
            subscriptions: {
              where: { status: 'active' },
              include: { plan: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (rows.length === 0) {
      return this.aiUsageFromSeedMetrics(range, aiSettings);
    }

    const lookups = rows.reduce((sum, r) => sum + r.lookupCount, 0);
    const quizzes = rows.reduce((sum, r) => sum + r.quizCount, 0);
    const tokens = rows.reduce((sum, r) => sum + Number(r.tokensUsed ?? 0), 0);
    const uniqueUsers = new Set(rows.map((r) => r.userId)).size;
    const avgLookupsPerUser = uniqueUsers > 0 ? lookups / uniqueUsers : 0;
    const avgCostPerLookup = 0.002;
    const costPerLookup = avgCostPerLookup;

    const byUser = new Map<
      string,
      {
        email: string;
        displayName: string | null;
        plan: string;
        lookups: number;
        monthLookups: number;
        quota: number;
      }
    >();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthRows = await this.prisma.aiUsageDaily.findMany({
      where: { usageDate: { gte: monthStart } },
    });
    const monthByUser = new Map<string, number>();
    for (const r of monthRows) {
      monthByUser.set(r.userId, (monthByUser.get(r.userId) ?? 0) + r.lookupCount);
    }

    for (const r of rows) {
      const plan = r.user.subscriptions[0]?.plan;
      const quota = plan?.aiDailyQuota ?? aiSettings.defaultUserQuota;
      const existing = byUser.get(r.userId);
      if (existing) {
        existing.lookups += r.lookupCount;
      } else {
        byUser.set(r.userId, {
          email: r.user.email,
          displayName: r.user.displayName,
          plan: plan?.name ?? 'Free',
          lookups: r.lookupCount,
          monthLookups: monthByUser.get(r.userId) ?? r.lookupCount,
          quota,
        });
      }
    }

    const topUsers = [...byUser.entries()]
      .sort((a, b) => b[1].lookups - a[1].lookups)
      .slice(0, 10)
      .map(([id, u]) => {
        const status =
          u.quota < 1_000_000 && u.lookups >= u.quota
            ? 'Suspended'
            : u.quota < 1_000_000 && u.lookups >= Math.max(1, Math.floor(u.quota * 0.9))
              ? 'Flagged'
              : 'Active';
        return {
          user: { id, email: u.email, displayName: u.displayName },
          plan: u.plan,
          lookups: u.lookups,
          monthLookups: u.monthLookups,
          cost: Number((u.lookups * costPerLookup).toFixed(2)),
          status,
          tokens: u.lookups * 32,
        };
      });

    const rateLimitedUsers = topUsers.filter((u) => u.status !== 'Active').length;
    const dayMap = new Map<string, { lookups: number; tokens: number }>();
    for (const r of rows) {
      const key = r.usageDate.toISOString().slice(0, 10);
      const cur = dayMap.get(key) ?? { lookups: 0, tokens: 0 };
      cur.lookups += r.lookupCount;
      cur.tokens += Number(r.tokensUsed ?? 0) || r.lookupCount * 32;
      dayMap.set(key, cur);
    }

    const today = new Date();
    const daily = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - i));
      const key = d.toISOString().slice(0, 10);
      const hit = dayMap.get(key);
      return {
        date: key,
        lookups: hit?.lookups ?? 0,
        tokens: hit?.tokens ?? 0,
      };
    });

    const hourlyLookups = Array.from({ length: 24 }, (_, i) => {
      // Daily aggregates only — distribute evenly for chart shape.
      const base = Math.floor(lookups / 24);
      return i < lookups % 24 ? base + 1 : base;
    });

    const chartPoints =
      range === '7d'
        ? daily.slice(-7).map((d) => ({
            label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
            value: d.lookups,
          }))
        : hourlyLookups.map((v, i) => ({
            label:
              i % 4 === 0 || i === hourlyLookups.length - 1
                ? i === 0
                  ? '12 AM'
                  : i === 12
                    ? '12 PM'
                    : `${i}`
                : '',
            value: v,
          }));

    const lookupPct = lookups + quizzes > 0 ? Math.round((lookups / (lookups + quizzes)) * 100) : 92;
    const quizPct = 100 - lookupPct;

    return {
      range,
      source: 'live',
      aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      aiEnabled: aiSettings.enabled,
      settings: {
        dailyLimit: aiSettings.dailyLimit,
        lookupModel: aiSettings.lookupModel,
        quizModel: aiSettings.quizModel,
        defaultUserQuota: aiSettings.defaultUserQuota,
      },
      today: {
        lookups,
        quizzes,
        tokens: tokens || lookups * 32,
        growthPct: 0,
        avgLookupsPerUser: Number(avgLookupsPerUser.toFixed(1)),
        avgLookupsTarget: aiSettings.defaultUserQuota,
        apiCostToday: Number((lookups * costPerLookup).toFixed(2)),
        avgCostPerLookup: costPerLookup,
        rateLimitedUsers,
        flagAlerts: rateLimitedUsers,
      },
      allTime: {
        lookups,
        quizzes,
        tokens: tokens || lookups * 32,
      },
      daily,
      hourlyLookups,
      chartPoints,
      chartKind: range === '7d' ? 'daily' : 'hourly',
      featureUsage: [
        { name: 'Word Lookup', pct: lookupPct, color: '#6c1d95' },
        { name: 'Quiz Gen', pct: quizPct, color: '#a855f7' },
      ],
      insight: aiSettings.enabled
        ? `Live usage from ${uniqueUsers} learner(s). Platform daily limit ${aiSettings.dailyLimit.toLocaleString()}; model ${aiSettings.lookupModel}.`
        : 'AI is disabled in Settings — learner lookups are blocked until re-enabled.',
      topUsers,
      categories: [
        { name: 'Lookup', value: lookups },
        { name: 'Quiz', value: quizzes },
      ],
    };
  }

  private async resolveAiSettings() {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: Object.values(AI_SETTING_KEYS) } },
    });
    const map: Record<string, unknown> = {};
    for (const row of rows) map[row.key] = row.value;
    return parseAiPlatformSettings(map);
  }

  private aiUsageFromSeedMetrics(range: string, aiSettings: ReturnType<typeof parseAiPlatformSettings>) {
    const metrics = FIGMA_ADMIN_METRICS;
    const a = metrics.aiUsage;
    const factor = this.aiRangeFactor(range);
    const today = new Date();
    const daily = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - i));
      const dayFactor = 0.85 + (i / 13) * 0.2;
      return {
        date: d.toISOString().slice(0, 10),
        lookups: Math.round(a.lookupsToday * dayFactor * 0.9),
        tokens: Math.round(a.lookupsToday * dayFactor * 28),
      };
    });

    const hourlyLookups =
      range === 'yesterday'
        ? a.hourlyLookups.map((v) => Math.round(v * 0.88))
        : range === '7d'
          ? daily.slice(-7).map((d) => d.lookups)
          : [...a.hourlyLookups];

    const chartPoints =
      range === '7d'
        ? daily.slice(-7).map((d) => ({
            label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
            value: d.lookups,
          }))
        : hourlyLookups.map((v, i) => ({
            label:
              i % 4 === 0 || i === hourlyLookups.length - 1
                ? i === 0
                  ? '12 AM'
                  : i === 12
                    ? '12 PM'
                    : `${i}`
                : '',
            value: v,
          }));

    const lookups = Math.round(a.lookupsToday * factor);

    return {
      range,
      source: 'seed',
      aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      aiEnabled: aiSettings.enabled,
      settings: {
        dailyLimit: aiSettings.dailyLimit,
        lookupModel: aiSettings.lookupModel,
        quizModel: aiSettings.quizModel,
        defaultUserQuota: aiSettings.defaultUserQuota,
      },
      today: {
        lookups,
        quizzes: Math.round(lookups * 0.08),
        tokens: Math.round(lookups * 32),
        growthPct: a.lookupsGrowthPct,
        avgLookupsPerUser: a.avgLookupsPerUser,
        avgLookupsTarget: aiSettings.defaultUserQuota || a.avgLookupsTarget,
        apiCostToday: Number((a.apiCostToday * factor).toFixed(2)),
        avgCostPerLookup: a.avgCostPerLookup,
        rateLimitedUsers: Math.max(1, Math.round(a.rateLimitedUsers * (range === '7d' ? 1.8 : factor))),
        flagAlerts: Math.max(1, Math.round(a.flagAlerts * (range === '7d' ? 2 : 1))),
      },
      allTime: {
        lookups: a.lookupsToday * 40,
        quizzes: Math.round(a.lookupsToday * 3.2),
        tokens: Math.round(a.lookupsToday * 32 * 40),
      },
      daily,
      hourlyLookups,
      chartPoints,
      chartKind: range === '7d' ? 'daily' : 'hourly',
      featureUsage: a.featureUsage.map((f) => ({ ...f })),
      insight: aiSettings.enabled
        ? `${a.insight} (demo seed — real stats appear after learner lookups are logged.)`
        : 'AI is disabled in Settings — learner lookups are blocked until re-enabled.',
      topUsers: a.topUsers.map((u) => ({
        user: { id: u.email, email: u.email, displayName: u.displayName },
        plan: u.plan,
        lookups: Math.round(u.today * (range === '7d' ? 6 : factor)),
        monthLookups: u.month,
        cost: Number((u.cost * (range === '7d' ? 1 : factor)).toFixed(2)),
        status: u.status,
        tokens: Math.round(u.today * 32 * (range === '7d' ? 6 : factor)),
      })),
      categories: a.categories.map((c) => ({ ...c })),
    };
  }

  async analytics(range = '30d') {
    const metrics = await this.getMetrics();
    const a = metrics.analytics;
    const factor = this.analyticsRangeFactor(range);
    const dau = Math.round(a.dau * (range === '7d' ? 0.92 : range === '90d' ? 1.08 : 1));

    return {
      range,
      kpis: {
        dau,
        dauGrowthPct: Number((a.dauGrowthPct * (range === '7d' ? 0.6 : range === '90d' ? 1.4 : 1)).toFixed(1)),
        avgSessionMin: a.avgSessionMin,
        avgSessionGrowthPct: a.avgSessionGrowthPct,
        lessonCompletionPct: a.lessonCompletionPct,
        lessonCompletionDeltaPct: a.lessonCompletionDeltaPct,
        retentionPct: a.retentionPct,
        retentionGrowthPct: a.retentionGrowthPct,
        revenue: metrics.content.activeSalesMonthly ?? metrics.dashboard.mrr,
        revenueGrowthPct: Number((metrics.dashboard.mrrGrowthPct * (range === '7d' ? 0.65 : 1)).toFixed(1)),
        users: metrics.dashboard.users,
        sessions: Math.round(dau * 18 * factor),
        vocab: Math.round(128400 * factor),
        content: metrics.content.published,
        readingHours: Math.round((dau * a.avgSessionMin * factor) / 60),
      },
      engagementByHour: a.engagementByHour.map((v) => Math.round(v * (range === '7d' ? 0.85 : range === '90d' ? 1.15 : 1))),
      languageDistribution: a.languageDistribution.map((l) => ({ ...l })),
      cefrDistribution: a.cefrDistribution.map((c) => ({
        level: c.level,
        count: Math.round(c.count * factor),
      })),
      featureUsage: a.featureUsage.map((f) => ({ ...f })),
      engagement: metrics.dashboard.userGrowth.map((m) => ({
        month: m.month,
        sessions: Math.round(m.users * 0.35 * factor),
        newUsers: Math.round(m.users * 0.08 * factor),
      })),
      byLanguage: a.languageDistribution.map((l) => ({
        language: l.name,
        code: l.name.slice(0, 2).toLowerCase(),
        count: Math.round((dau * l.pct) / 100),
        pct: l.pct,
        color: l.color,
      })),
    };
  }

  async languages() {
    const catalog = await this.prisma.languageCatalog.findMany();
    const byCode = new Map(catalog.map((l) => [l.code, l]));

    const [contentGroups, learnerGroups, cefrGroups] = await Promise.all([
      this.prisma.contentItem.groupBy({
        by: ['language'],
        _count: { _all: true },
      }),
      this.prisma.userTargetLanguage.groupBy({
        by: ['targetLanguage'],
        _count: { _all: true },
      }),
      this.prisma.contentItem.groupBy({
        by: ['language', 'cefrLevel'],
        _count: { _all: true },
      }),
    ]);

    const contentByLang = new Map(contentGroups.map((g) => [g.language, g._count._all]));
    const learnersByLang = new Map(
      learnerGroups.map((g) => [g.targetLanguage, g._count._all]),
    );
    const cefrLevelsByLang = new Map<string, Set<string>>();
    for (const g of cefrGroups) {
      const set = cefrLevelsByLang.get(g.language) ?? new Set<string>();
      set.add(g.cefrLevel);
      cefrLevelsByLang.set(g.language, set);
    }

    const codes = Object.values(AppLanguage);
    const languages = codes
      .map((code, idx) => {
        const row = byCode.get(code);
        const contentCount = contentByLang.get(code) ?? 0;
        const learnerCount = learnersByLang.get(code) ?? 0;
        const cefrCoverage = Math.round(((cefrLevelsByLang.get(code)?.size ?? 0) / 6) * 100);
        const isEnabled = row?.isEnabled ?? true;
        return {
          code,
          name: row?.name ?? this.langLabel(code),
          nativeName: row?.nativeName ?? this.langNative(code),
          flagEmoji: row?.flagEmoji ?? this.langFlag(code),
          regionLabel: row?.regionLabel ?? null,
          status: row?.status ?? (isEnabled ? 'Active' : 'Draft'),
          cefrCoverage,
          learnerCount,
          contentCount,
          isEnabled,
          sortOrder: row?.sortOrder ?? idx + 1,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const enabled = languages.filter((l) => l.isEnabled);
    const totalContentItems = languages.reduce((s, l) => s + l.contentCount, 0);
    const avgCefrCoverage = languages.length
      ? Math.round(languages.reduce((s, l) => s + l.cefrCoverage, 0) / languages.length)
      : 0;

    return {
      stats: {
        supported: enabled.length,
        totalContentItems,
        avgCefrCoverage,
      },
      languages,
    };
  }

  async updateLanguage(code: string, body: { isEnabled?: boolean; status?: string }) {
    const isEnabled = body.isEnabled;
    const status =
      body.status ??
      (isEnabled === false ? 'Draft' : isEnabled === true ? 'Active' : undefined);
    return this.prisma.languageCatalog.upsert({
      where: { code },
      update: {
        isEnabled,
        status,
      },
      create: {
        code,
        name: this.langLabel(code),
        nativeName: this.langNative(code),
        flagEmoji: this.langFlag(code),
        status: status ?? 'Active',
        cefrCoverage: 0,
        learnerCount: 0,
        contentCount: 0,
        isEnabled: isEnabled ?? true,
        sortOrder: 99,
      },
    });
  }

  async levelTests() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [results, total, monthTotal, avgAgg, byLevel] = await Promise.all([
      this.prisma.placementResult.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      this.prisma.placementResult.count(),
      this.prisma.placementResult.count({ where: { createdAt: { gte: monthStart } } }),
      this.prisma.placementResult.aggregate({ _avg: { score: true } }),
      this.prisma.placementResult.groupBy({
        by: ['suggestedLevel'],
        _count: { _all: true },
        _avg: { score: true },
      }),
    ]);

    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(results.map((r) => r.userId))] } },
      select: { id: true, email: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const levelOrder = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'];
    const byLevelSorted = [...byLevel].sort(
      (a, b) => levelOrder.indexOf(a.suggestedLevel) - levelOrder.indexOf(b.suggestedLevel),
    );

    return {
      stats: {
        total,
        monthTotal,
        avgScore: Number((avgAgg._avg.score ?? 0).toFixed(1)),
        byLevel: byLevelSorted.map((r) => ({
          level: r.suggestedLevel,
          count: r._count._all,
          avgScore: Number((r._avg.score ?? 0).toFixed(1)),
          pct: total > 0 ? Math.round((r._count._all / total) * 100) : 0,
        })),
      },
      results: results.map((r) => ({
        ...r,
        user: userMap.get(r.userId) ?? null,
      })),
    };
  }

  async gamification() {
    const achievements = await this.prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } });
    const [streakers, vocabMasters, sessionUsers, streakAgg] = await Promise.all([
      this.prisma.user.count({ where: { streakCount: { gte: 7 }, deletedAt: null } }),
      this.prisma.userVocabulary.count({ where: { mastered: true } }),
      this.prisma.readingSession.groupBy({
        by: ['userId'],
        _count: { _all: true },
      }),
      this.prisma.user.aggregate({
        where: { deletedAt: null },
        _avg: { streakCount: true },
        _sum: { streakCount: true },
      }),
    ]);

    const catalogPoints = achievements.reduce((sum, a) => sum + (a.points ?? 0), 0);
    const avgStreakDays = Number((streakAgg._avg.streakCount ?? 0).toFixed(1));

    return {
      stats: {
        achievements: achievements.length,
        activeAchievements: achievements.filter((a) => a.isActive).length,
        streakers,
        vocabMasters,
        activeReaders: sessionUsers.filter((s) => s._count._all >= 5).length,
        // No UserAchievement ledger — catalog points + live avg streak only.
        catalogPoints,
        avgStreakDays,
        totalEarned: catalogPoints,
      },
      // No leaderboard season model in schema — clients should hide if empty.
      seasons: [] as Array<{
        id: string;
        title: string;
        status: string;
        endsInDays: number | null;
        participants: number;
      }>,
      achievements,
    };
  }

  createAchievement(body: Record<string, unknown>) {
    return this.prisma.achievement.create({
      data: {
        code: String(body.code ?? `ach_${Date.now()}`),
        title: String(body.title ?? 'New Achievement'),
        description: String(body.description ?? ''),
        category: (body.category as AchievementCategory) ?? AchievementCategory.special,
        iconKey: body.iconKey ? String(body.iconKey) : undefined,
        points: Number(body.points ?? 10),
        threshold: Number(body.threshold ?? 1),
        isActive: body.isActive !== false,
        sortOrder: Number(body.sortOrder ?? 0),
      },
    });
  }

  updateAchievement(id: string, body: Record<string, unknown>) {
    return this.prisma.achievement.update({
      where: { id },
      data: {
        title: body.title !== undefined ? String(body.title) : undefined,
        description: body.description !== undefined ? String(body.description) : undefined,
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
        points: body.points !== undefined ? Number(body.points) : undefined,
        threshold: body.threshold !== undefined ? Number(body.threshold) : undefined,
      },
    });
  }

  async notifications() {
    const campaigns = await this.prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const [draft, scheduled, sent] = await Promise.all([
      this.prisma.notificationCampaign.count({ where: { status: 'draft' } }),
      this.prisma.notificationCampaign.count({ where: { status: 'scheduled' } }),
      this.prisma.notificationCampaign.count({ where: { status: 'sent' } }),
    ]);
    return { stats: { draft, scheduled, sent, total: campaigns.length }, campaigns };
  }

  createCampaign(adminId: string, body: Record<string, unknown>) {
    return this.prisma.notificationCampaign.create({
      data: {
        name: String(body.name ?? 'Untitled campaign'),
        subject: String(body.subject ?? ''),
        body: String(body.body ?? ''),
        channel: (body.channel as CampaignChannel) ?? CampaignChannel.push,
        status: (body.status as CampaignStatus) ?? CampaignStatus.draft,
        audience: String(body.audience ?? 'all'),
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined,
        createdById: adminId,
      },
    });
  }

  async updateCampaign(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.notificationCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    return this.prisma.notificationCampaign.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        subject: body.subject !== undefined ? String(body.subject) : undefined,
        body: body.body !== undefined ? String(body.body) : undefined,
        channel: body.channel !== undefined ? (body.channel as CampaignChannel) : undefined,
        audience: body.audience !== undefined ? String(body.audience) : undefined,
        status: body.status !== undefined ? (body.status as CampaignStatus) : undefined,
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined,
        sentAt: body.status === 'sent' ? new Date() : undefined,
      },
    });
  }

  async support() {
    const tickets = await this.prisma.supportTicket.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const [open, inProgress, resolved] = await Promise.all([
      this.prisma.supportTicket.count({ where: { status: 'open' } }),
      this.prisma.supportTicket.count({ where: { status: 'in_progress' } }),
      this.prisma.supportTicket.count({ where: { status: 'resolved' } }),
    ]);

    const userIds = [...new Set(tickets.map((t) => t.userId).filter(Boolean))] as string[];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      stats: { open, inProgress, resolved, total: tickets.length },
      tickets: tickets.map((t) => ({
        ...t,
        user: t.userId ? userMap.get(t.userId) ?? null : null,
      })),
    };
  }

  createTicket(body: Record<string, unknown>) {
    return this.prisma.supportTicket.create({
      data: {
        userId: body.userId ? String(body.userId) : undefined,
        subject: String(body.subject ?? 'Support request'),
        body: String(body.body ?? ''),
        status: (body.status as SupportTicketStatus) ?? SupportTicketStatus.open,
        priority: (body.priority as SupportTicketPriority) ?? SupportTicketPriority.medium,
        category: String(body.category ?? 'general'),
      },
    });
  }

  async updateTicket(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.supportTicket.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Ticket not found');
    const status = body.status !== undefined ? (body.status as SupportTicketStatus) : undefined;
    return this.prisma.supportTicket.update({
      where: { id },
      data: {
        status,
        priority: body.priority !== undefined ? (body.priority as SupportTicketPriority) : undefined,
        assigneeId: body.assigneeId !== undefined ? String(body.assigneeId) : undefined,
        resolvedAt: status === 'resolved' || status === 'closed' ? new Date() : undefined,
      },
    });
  }

  async settings() {
    const rows = await this.prisma.platformSetting.findMany();
    const map: Record<string, unknown> = {};
    for (const row of rows) {
      if (row.key === ADMIN_METRICS_KEY) continue;
      map[row.key] = row.value;
    }

    const aiDefaults = defaultAiPlatformSettings();
    return {
      platformName: 'GOTCHA',
      supportEmail: 'support@gotcha.app',
      maintenanceMode: false,
      allowRegistrations: true,
      defaultCefr: 'a2',
      contentModerationEnabled: true,
      autoApproveImports: false,
      [AI_SETTING_KEYS.enabled]: aiDefaults.enabled,
      [AI_SETTING_KEYS.dailyLimit]: aiDefaults.dailyLimit,
      [AI_SETTING_KEYS.lookupModel]: aiDefaults.lookupModel,
      [AI_SETTING_KEYS.quizModel]: aiDefaults.quizModel,
      [AI_SETTING_KEYS.importCleanupModel]: aiDefaults.importCleanupModel,
      [AI_SETTING_KEYS.defaultUserQuota]: aiDefaults.defaultUserQuota,
      aiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      ...map,
    };
  }

  async updateSettings(body: Record<string, unknown>) {
    const entries = Object.entries(body).filter(
      ([key]) => key !== ADMIN_METRICS_KEY && key !== 'aiConfigured',
    );
    await Promise.all(
      entries.map(([key, value]) =>
        this.prisma.platformSetting.upsert({
          where: { key },
          update: { value: value as never },
          create: { key, value: value as never },
        }),
      ),
    );
    return this.settings();
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.adminProfile?.role ?? null,
    };
  }

  /**
   * Admin self-service profile update (own display name / email).
   * Mirrors users.service.ts's updateProfile but scoped to admin.controller.ts (`PATCH /admin/me`),
   * since the admin panel authenticates via the same JWT/User row but has its own settings UI.
   */
  async updateMe(userId: string, dto: UpdateAdminProfileDto) {
    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      const existing = await this.prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('Email is already in use by another account.');
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName?.trim() || undefined,
        email: dto.email ? dto.email.trim().toLowerCase() : undefined,
      },
      include: { adminProfile: true },
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      role: user.adminProfile?.role ?? null,
    };
  }

  private mapUserRow(u: {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
    createdAt: Date;
    streakCount: number;
    targetLanguages: Array<{ targetLanguage: AppLanguage; cefrLevel: string; isPrimary: boolean }>;
    subscriptions: Array<{ status: string; plan: { name: string; tier: string } }>;
  }) {
    const sub = u.subscriptions[0];
    const primary = u.targetLanguages.find((t) => t.isPrimary) ?? u.targetLanguages[0];
    return {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      createdAt: u.createdAt,
      streakCount: u.streakCount,
      targetLanguage: primary ? this.langLabel(primary.targetLanguage) : '—',
      targetLanguageCode: primary?.targetLanguage ?? null,
      cefrLevel: primary?.cefrLevel ?? null,
      billingTier: sub ? (sub.plan.tier === 'premium' ? 'Premium' : 'Free') : 'Free',
      subscriptionStatus: sub?.status ?? 'none',
    };
  }

  private lastNMonths(n: number) {
    const out: Array<{ label: string; start: Date; end: Date }> = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      out.push({
        label: start.toLocaleString('en', { month: 'short' }),
        start,
        end,
      });
    }
    return out;
  }

  private langLabel(code: AppLanguage | string) {
    const map: Record<string, string> = {
      en: 'English', ru: 'Russian', uz: 'Uzbek', fr: 'French', es: 'Spanish',
      ja: 'Japanese', de: 'German', ko: 'Korean', pt: 'Portuguese',
    };
    return map[code] ?? String(code);
  }

  private langNative(code: AppLanguage | string) {
    const map: Record<string, string> = {
      en: 'English', ru: 'Русский', uz: "Oʻzbekcha", fr: 'Français', es: 'Español',
      ja: '日本語', de: 'Deutsch', ko: '한국어', pt: 'Português',
    };
    return map[code] ?? String(code);
  }

  private langFlag(code: AppLanguage | string) {
    const map: Record<string, string> = {
      en: '🇬🇧', ru: '🇷🇺', uz: '🇺🇿', fr: '🇫🇷', es: '🇪🇸',
      ja: '🇯🇵', de: '🇩🇪', ko: '🇰🇷', pt: '🇵🇹',
    };
    return map[code] ?? '🌐';
  }
}
