import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AppLanguage,
  CampaignChannel,
  CampaignStatus,
  ContentSource,
  ContentType,
  LicenseStatus,
  ModerationStatus,
  Prisma,
  PublishStatus,
  SubscriptionTier,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { tokenizeText, slugify, uniqueWordCount } from '../../utils/tokenizer';
import { AiService } from '../ai/ai.service';
import { chaptersHaveRealTitles } from '../imports/chapter-split';
import {
  buildSegmentsFromChapters,
  extractSourceDocument,
  previewFromSegments,
  segmentStats,
  type BuiltSegment,
} from './content-ingest';
import {
  ADMIN_METRICS_KEY,
  FIGMA_ADMIN_METRICS,
  FigmaAdminMetrics,
} from './admin-figma-metrics';
import {
  AI_SETTING_KEYS,
  coerceNonNegInt,
  defaultAiPlatformSettings,
  parseAiPlatformSettings,
} from '../ai/ai-settings';
import { AuthService } from '../auth/auth.service';
import { UpdateAdminProfileDto } from './dto/admin.dto';
import { assertAtmosMinPriceSom, atmosMinAmountSom } from '../billing/atmos.client';
import { assertJpegPngOrWebp } from '../../common/upload-magic';
import { liveLearnerWhere, syntheticUserEmailWhere } from '../../common/production-users';
import { defaultPageTierLabel, describePageTierGaps, normalizeAllowedFormats } from '../../common/import-format';
import {
  normalizeCampaignAudience,
  PUSH_CAMPAIGN_CHANNELS,
} from '../../common/campaign-audience';
import {
  ensureLanguageCatalog,
  isAppLanguageCode,
  assertEnabledLanguage,
} from '../../common/language-catalog';
import { APP_LANGUAGES, CEFR_LEVELS, LANGUAGE_META, LIVE_LANGUAGES, languageFlag, languageLabel } from '@gotcha/shared';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
    private ai: AiService,
  ) {}

  private async getMetrics(): Promise<FigmaAdminMetrics> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: ADMIN_METRICS_KEY } });
    if (row?.value && typeof row.value === 'object') {
      return { ...FIGMA_ADMIN_METRICS, ...(row.value as object) } as FigmaAdminMetrics;
    }
    return FIGMA_ADMIN_METRICS;
  }

  async dashboard() {
    await this.purgeSeedSupportTickets();
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
      paidImportUsers,
      activeTodayRows,
      publishedContent,
      userImports,
      moderationPending,
      ingestionQueued,
      aiTodayAgg,
      importPaidMonthAgg,
      importPaidPrevMonthAgg,
      importPaidTodayAgg,
      recentUsersRaw,
      recentPublished,
      recentTickets,
      importPaymentsSince,
    ] = await Promise.all([
      this.prisma.user.count({ where: liveLearnerWhere() }),
      this.prisma.user.count({ where: { ...liveLearnerWhere(), createdAt: { gte: weekAgo } } }),
      this.prisma.user.count({
        where: { ...liveLearnerWhere(), createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      this.prisma.importPayment.findMany({
        where: { status: 'paid', user: liveLearnerWhere() },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.readingSession.findMany({
        where: { startedAt: { gte: dayStart }, user: liveLearnerWhere() },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.contentItem.count({ where: { publishStatus: PublishStatus.published } }),
      this.prisma.userImport.count(),
      this.prisma.moderationQueue.count({ where: { status: 'pending' } }),
      this.prisma.ingestionJob.count({ where: { status: 'queued' } }),
      this.prisma.aiUsageDaily.aggregate({
        where: { usageDate: { gte: dayStart }, user: liveLearnerWhere() },
        _sum: { lookupCount: true, quizCount: true, tokensUsed: true },
      }),
      // Real revenue only: completed/paid Atmos import payments (UZS). Never blend in
      // UserSubscription.plan.priceMonthly here — those rows only exist from seed data or
      // a manual admin "adjust tier" override, never from an actual user purchase.
      this.prisma.importPayment
        .aggregate({
          where: { status: 'paid', paidAt: { gte: monthStart } },
          _sum: { amountTiyins: true },
        })
        .catch(() => ({ _sum: { amountTiyins: 0 as number | null } })),
      this.prisma.importPayment
        .aggregate({
          where: { status: 'paid', paidAt: { gte: prevMonthStart, lte: prevMonthEnd } },
          _sum: { amountTiyins: true },
        })
        .catch(() => ({ _sum: { amountTiyins: 0 as number | null } })),
      this.prisma.importPayment
        .aggregate({
          where: { status: 'paid', paidAt: { gte: dayStart } },
          _sum: { amountTiyins: true },
        })
        .catch(() => ({ _sum: { amountTiyins: 0 as number | null } })),
      this.prisma.user.findMany({
        where: liveLearnerWhere(),
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
      this.prisma.importPayment
        .findMany({
          where: {
            status: 'paid',
            paidAt: { gte: new Date(dayStart.getTime() - 6 * 86_400_000) },
          },
          select: { amountTiyins: true, paidAt: true },
        })
        .catch(() => [] as Array<{ amountTiyins: number; paidAt: Date | null }>),
    ]);

    const payAsYouGoIds = new Set(paidImportUsers.map((r) => r.userId));
    const activeSubscribers = payAsYouGoIds.size;
    const activeToday = activeTodayRows.length;
    const revenueMonthUzs = Math.round((importPaidMonthAgg._sum.amountTiyins ?? 0) / 100);
    const revenuePrevUzs = Math.round((importPaidPrevMonthAgg._sum.amountTiyins ?? 0) / 100);
    const revenueTodayUzs = Math.round((importPaidTodayAgg._sum.amountTiyins ?? 0) / 100);
    const revenueMomDelta = revenueMonthUzs - revenuePrevUzs;
    const revenueGrowthPct =
      revenuePrevUzs > 0
        ? Number((((revenueMonthUzs - revenuePrevUzs) / revenuePrevUzs) * 100).toFixed(1))
        : revenueMonthUzs > 0
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
          where: { ...liveLearnerWhere(), createdAt: { lte: m.end } },
        }),
      })),
    );

    // Real revenue trend only — sums of paid Atmos import payments per month, in UZS.
    const revenueTrend = await Promise.all(
      months.map(async (m) => {
        const paid = await this.prisma.importPayment
          .aggregate({
            where: { status: 'paid', paidAt: { gte: m.start, lte: m.end } },
            _sum: { amountTiyins: true },
          })
          .catch(() => ({ _sum: { amountTiyins: 0 as number | null } }));
        return {
          month: m.label,
          revenue: Math.round((paid._sum.amountTiyins ?? 0) / 100),
          users: 0,
        };
      }),
    );

    const revenueDailyMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(dayStart);
      d.setDate(d.getDate() - i);
      revenueDailyMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const p of importPaymentsSince) {
      if (!p.paidAt) continue;
      const key = p.paidAt.toISOString().slice(0, 10);
      if (revenueDailyMap.has(key)) {
        revenueDailyMap.set(key, (revenueDailyMap.get(key) ?? 0) + Math.round(p.amountTiyins / 100));
      }
    }

    const revenueDaily = [...revenueDailyMap.entries()].map(([date, amount]) => ({
      month: new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' }),
      day: date,
      revenue: amount,
      users: 0,
    }));

    const recentUsers = recentUsersRaw.map((u) => {
      const mapped = this.mapUserRow(u, { payAsYouGo: payAsYouGoIds.has(u.id) });
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
      const mapped = this.mapUserRow(u, { payAsYouGo: payAsYouGoIds.has(u.id) });
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

    return {
      users,
      publishedContent,
      userImports,
      moderationPending,
      ingestionQueued,
      activeSubscribers,
      activeToday,
      engagementPct,
      // Real revenue only — sum of paid Atmos import payments (UZS). This intentionally
      // excludes UserSubscription.plan.priceMonthly, which only reflects seed data or a
      // manual admin "adjust tier" override, never an actual user purchase (see
      // docs/E2E_AUDIT_REPORT.md §7.2).
      revenue: revenueMonthUzs,
      revenueGrowthPct,
      aiLookupsToday,
      aiLimit,
      aiDefaultUserQuota: aiSettings.defaultUserQuota,
      aiUsagePct,
      userGrowthPct,
      conversionPct,
      revenueToday: revenueTodayUzs,
      revenueMomDelta,
      aiUsageTotal: {
        tokensUsed: aiTokensToday,
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
      // Revenue is real Atmos import-payment income, always UZS.
      revenueCurrency: 'UZS',
    };
  }

  async listUsers(q?: string, tier?: string, status?: string) {
    const statusKey = (status ?? '').trim().toLowerCase();
    const tierKey = (tier ?? '').trim().toLowerCase();
    const includeSuspended = statusKey === 'suspended';
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const weekAgo = new Date(dayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [paidImportUsers, activeRecentRows] = await Promise.all([
      this.prisma.importPayment.findMany({
        where: { status: 'paid', user: liveLearnerWhere() },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.readingSession.findMany({
        where: { startedAt: { gte: weekAgo } },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);

    const payAsYouGoIds = new Set(paidImportUsers.map((r) => r.userId));
    const activeRecentIds = new Set(activeRecentRows.map((r) => r.userId));

    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: includeSuspended ? { not: null } : null,
        NOT: syntheticUserEmailWhere(),
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
      const payAsYouGo = payAsYouGoIds.has(u.id);
      const mapped = this.mapUserRow(u, { payAsYouGo });
      const isSuspended = Boolean(u.deletedAt);
      return {
        ...mapped,
        planLabel: payAsYouGo ? 'Pay as you go' : 'Free',
        isAdmin: Boolean(u.adminProfile),
        adminRole: u.adminProfile?.role ?? null,
        vocabCount: u._count.vocabulary,
        sessionCount: u._count.readingSessions,
        isFlagged: false,
        isSuspended,
        isActiveRecently: activeRecentIds.has(u.id) && !isSuspended,
      };
    });

    const wantsPayg =
      tierKey === 'premium' || tierKey === 'payg' || tierKey === 'pay as you go';
    if (wantsPayg) {
      rows = rows.filter((r) => r.billingTier.toLowerCase().includes('pay'));
    } else if (tierKey === 'free') {
      rows = rows.filter((r) => !r.billingTier.toLowerCase().includes('pay'));
    }

    const [total, suspended] = await Promise.all([
      this.prisma.user.count({ where: liveLearnerWhere() }),
      this.prisma.user.count({
        where: { deletedAt: { not: null }, NOT: syntheticUserEmailWhere() },
      }),
    ]);
    const payAsYouGo = payAsYouGoIds.size;

    return {
      stats: {
        total,
        premium: payAsYouGo,
        payAsYouGo,
        free: Math.max(0, total - payAsYouGo),
        suspended,
        flagged: 0,
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

    const [recentSessions, recentVocab, recentImports, paidImport] = await Promise.all([
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
      this.prisma.importPayment.findFirst({
        where: { userId: id, status: 'paid' },
        select: { id: true },
      }),
    ]);

    const payAsYouGo = Boolean(paidImport);
    const isSuspended = Boolean(u.deletedAt);
    const recentRead = await this.prisma.readingSession.findFirst({
      where: { userId: id, startedAt: { gte: weekAgo } },
      select: { id: true },
    });

    const mapped = this.mapUserRow(u, { payAsYouGo });
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

    activity.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));

    return {
      ...mapped,
      planLabel: payAsYouGo ? 'Pay as you go' : 'Free',
      isAdmin: Boolean(u.adminProfile),
      adminRole: u.adminProfile?.role ?? null,
      vocabCount: u._count.vocabulary,
      sessionCount: u._count.readingSessions,
      isFlagged: false,
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

  private catalogFilter(opts?: {
    language?: string;
    level?: string;
    q?: string;
  }): Prisma.ContentItemWhereInput {
    const extra: Prisma.ContentItemWhereInput = {};
    const language = (opts?.language ?? '').trim().toLowerCase();
    const level = (opts?.level ?? '').trim().toLowerCase();
    const q = (opts?.q ?? '').trim();
    if (language && language !== 'all' && Object.values(AppLanguage).includes(language as AppLanguage)) {
      extra.language = language as AppLanguage;
    }
    if (level && level !== 'all' && ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].includes(level)) {
      extra.cefrLevel = level as never;
    }
    if (q) {
      extra.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { author: { contains: q, mode: 'insensitive' } },
      ];
    }
    return extra;
  }

  private catalogWhere(extra?: Prisma.ContentItemWhereInput): Prisma.ContentItemWhereInput {
    return {
      AND: [
        { contentSource: { not: ContentSource.user_import } },
        { contentType: { not: ContentType.user_import } },
        ...(extra && Object.keys(extra).length > 0 ? [extra] : []),
      ],
    };
  }

  listContent(status?: PublishStatus) {
    return this.prisma.contentItem.findMany({
      where: this.catalogWhere(status ? { publishStatus: status } : undefined),
      orderBy: { updatedAt: 'desc' },
      include: { license: true, _count: { select: { readingProgress: true, segments: true } } },
    });
  }

  async contentStats(language?: string, level?: string) {
    const filter = this.catalogFilter({ language, level });
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [total, published, draft, review, archived, freeItems, paidMonth] = await Promise.all([
      this.prisma.contentItem.count({ where: this.catalogWhere(filter) }),
      this.prisma.contentItem.count({
        where: this.catalogWhere({ ...filter, publishStatus: PublishStatus.published }),
      }),
      this.prisma.contentItem.count({
        where: this.catalogWhere({ ...filter, publishStatus: PublishStatus.draft }),
      }),
      this.prisma.contentItem.count({
        where: this.catalogWhere({ ...filter, publishStatus: PublishStatus.review }),
      }),
      this.prisma.contentItem.count({
        where: this.catalogWhere({ ...filter, publishStatus: PublishStatus.archived }),
      }),
      this.prisma.contentItem.count({
        where: this.catalogWhere({ ...filter, isFree: true }),
      }),
      this.prisma.importPayment
        .aggregate({
          where: { status: 'paid', paidAt: { gte: monthStart } },
          _sum: { amountTiyins: true },
        })
        .catch(() => ({ _sum: { amountTiyins: 0 as number | null } })),
    ]);
    return {
      total,
      published,
      draft,
      review,
      archived,
      activeSalesMonthly: Math.round((paidMonth._sum.amountTiyins ?? 0) / 100),
      currency: 'UZS',
      freeItems,
    };
  }

  /** Real ContentItem rows for the admin Content Library (Publish/Archive use these IDs). */
  async listCurriculum(type?: string, language?: string, level?: string, q?: string) {
    // User Imports tab is ops UI (moderation/ingestion/licenses); no curriculum rows.
    if (type === 'user_imports') return [];

    const typeKey = (type ?? 'all').trim().toLowerCase();
    const typeFilter =
      !typeKey || typeKey === 'all' || typeKey === 'pricing'
        ? undefined
        : { contentType: typeKey as ContentType };
    const where = this.catalogWhere({
      ...this.catalogFilter({ language, level, q }),
      ...typeFilter,
    });

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
        priceUzs: Number(item.priceUsd ?? 0),
        salesCount: item.salesCount,
        author: item.author,
        subtitle: item.subtitle,
        description: item.description,
        coverImageKey: item.coverImageKey,
      };
    });
  }

  private parseContentPricing(body: Record<string, unknown>) {
    const isFree = body.isFree === true || body.isFree === 'true' || body.pricing === 'free';
    const rawPrice = body.priceUsd ?? body.priceUzs ?? body.price;
    const priceUsd = isFree ? 0 : Number(rawPrice ?? 0);
    const amount = Number.isFinite(priceUsd) ? priceUsd : 0;
    if (!isFree && amount > 0 && amount < 500) {
      throw new BadRequestException('Paid catalog items must be at least 500 soʻm (Atmos minimum).');
    }
    return {
      isFree,
      priceUsd: amount,
    };
  }

  private literaryType(type: string) {
    return type === 'book' || type === 'story';
  }

  private async ingestSegments(body: Record<string, unknown>): Promise<BuiltSegment[]> {
    const contentType = String(body.contentType ?? 'article');
    const mode = this.literaryType(contentType) ? 'literary' : 'tight';
    const incoming = Array.isArray(body.chapters)
      ? (body.chapters as Array<{ title?: string; text?: string }>)
          .map((c) => ({ title: String(c.title ?? 'Chapter'), text: String(c.text ?? '') }))
          .filter((c) => c.text.trim())
      : null;
    if (incoming?.length) {
      return buildSegmentsFromChapters(incoming, mode);
    }
    const extracted = await extractSourceDocument({
      plainText: body.plainText ? String(body.plainText) : undefined,
      sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
      title: body.title ? String(body.title) : undefined,
      pdfBuffer: Buffer.isBuffer(body.pdfBuffer) ? body.pdfBuffer : undefined,
      language: body.language ? String(body.language) : undefined,
    });
    let chapters = extracted.chapters;
    // Books/stories: keep the deterministic chapter tree. AI cleanup is for
    // article chrome and truncates novels (chunk budget), which looks like
    // "chapters missing" on Gutenberg-scale URLs.
    const hasBookStructure = chaptersHaveRealTitles(chapters) && chapters.length >= 2;
    if (mode === 'tight' && !hasBookStructure) {
      const text = extracted.text || chapters.map((c) => c.text).join('\n\n');
      return buildSegmentsFromChapters([{ title: extracted.title || 'Content', text }], 'tight');
    }
    return buildSegmentsFromChapters(chapters, 'literary');
  }

  async previewContentIngest(body: Record<string, unknown>) {
    const segments = await this.ingestSegments(body);
    const stats = segmentStats(segments);
    return {
      title: body.title ? String(body.title) : undefined,
      wordCount: stats.wordCount,
      uniqueWordCount: stats.uniqueWordCount,
      chapterCount: new Set(segments.map((s) => s.chapterIndex)).size,
      pageCount: segments.length,
      chapters: previewFromSegments(segments),
      chaptersPayload: segments.reduce<Array<{ title: string; text: string }>>((acc, seg) => {
        const existing = acc[seg.chapterIndex];
        if (!existing) acc[seg.chapterIndex] = { title: seg.chapterTitle, text: seg.plainText };
        else existing.text = `${existing.text}\n\n${seg.plainText}`;
        return acc;
      }, []),
    };
  }

  async createContent(adminId: string, body: Record<string, unknown>) {
    const title = String(body.title ?? 'Untitled');
    const contentType = (body.contentType as ContentType) ?? ContentType.article;
    const language = String(body.language ?? 'en');
    await assertEnabledLanguage(this.prisma, language, 'Content language');
    const pricing = this.parseContentPricing(body);
    const segments = await this.ingestSegments(body);
    const stats = segmentStats(segments);
    const author = body.author ? String(body.author).trim() : undefined;

    const item = await this.prisma.contentItem.create({
      data: {
        slug: `${slugify(title)}-${Date.now()}`,
        title,
        author,
        subtitle: author,
        description: body.description ? String(body.description) : undefined,
        language: language as never,
        contentType,
        contentSource: (body.contentSource as ContentSource) ?? ContentSource.public_domain,
        cefrLevel: (body.cefrLevel as never) ?? 'b1',
        genre: body.genre ? String(body.genre) : undefined,
        sourceUrl: body.sourceUrl ? String(body.sourceUrl) : undefined,
        licenseId: body.licenseId ? String(body.licenseId) : undefined,
        isFree: pricing.isFree,
        priceUsd: pricing.priceUsd,
        wordCount: stats.wordCount,
        uniqueWordCount: stats.uniqueWordCount,
        publishStatus: PublishStatus.draft,
        createdById: adminId,
      },
    });

    const BATCH = 80;
    for (let i = 0; i < segments.length; i += BATCH) {
      const batch = segments.slice(i, i + BATCH);
      await this.prisma.contentSegment.createMany({
        data: batch.map((s) => ({
          contentId: item.id,
          segmentIndex: s.segmentIndex,
          chapterIndex: s.chapterIndex,
          chapterTitle: s.chapterTitle,
          pageIndex: s.pageIndex,
          title: s.title,
          plainText: s.plainText,
          tokenMap: s.tokenMap as never,
          sentenceMap: s.sentenceMap as never,
          wordCount: s.wordCount,
        })),
      });
    }

    return {
      id: item.id,
      title: item.title,
      author: item.author,
      contentType: item.contentType,
      publishStatus: item.publishStatus,
      wordCount: item.wordCount,
      chapterCount: new Set(segments.map((s) => s.chapterIndex)).size,
      pageCount: segments.length,
    };
  }

  /** Replace segment text in place — preserves cover, pricing, and metadata. */
  async reingestContentText(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content not found');
    if (
      existing.contentSource === ContentSource.user_import ||
      existing.contentType === ContentType.user_import
    ) {
      throw new BadRequestException('Learner imports cannot be re-ingested from the catalog.');
    }

    const segments = await this.ingestSegments({
      ...body,
      title: body.title ?? existing.title,
      contentType: body.contentType ?? existing.contentType,
      language: body.language ?? existing.language,
    });
    if (!segments.length) throw new BadRequestException('No text to ingest');
    const stats = segmentStats(segments);

    await this.prisma.$transaction(async (tx) => {
      await tx.contentSegment.deleteMany({ where: { contentId: id } });
      const BATCH = 80;
      for (let i = 0; i < segments.length; i += BATCH) {
        const batch = segments.slice(i, i + BATCH);
        await tx.contentSegment.createMany({
          data: batch.map((s) => ({
            contentId: id,
            segmentIndex: s.segmentIndex,
            chapterIndex: s.chapterIndex,
            chapterTitle: s.chapterTitle,
            pageIndex: s.pageIndex,
            title: s.title,
            plainText: s.plainText,
            tokenMap: s.tokenMap as never,
            sentenceMap: s.sentenceMap as never,
            wordCount: s.wordCount,
          })),
        });
      }
      await tx.contentItem.update({
        where: { id },
        data: {
          wordCount: stats.wordCount,
          uniqueWordCount: stats.uniqueWordCount,
        },
      });
    });

    return {
      id,
      title: existing.title,
      coverImageKey: existing.coverImageKey,
      wordCount: stats.wordCount,
      chapterCount: new Set(segments.map((s) => s.chapterIndex)).size,
      pageCount: segments.length,
    };
  }

  async getContent(id: string) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      include: { segments: { orderBy: { segmentIndex: 'asc' } }, license: true },
    });
    if (!item) throw new NotFoundException('Content not found');
    const author = item.author?.trim() || item.subtitle?.trim() || null;
    return {
      id: item.id,
      slug: item.slug,
      title: item.title,
      author,
      subtitle: item.subtitle,
      description: item.description,
      genre: item.genre,
      language: item.language,
      cefrLevel: item.cefrLevel,
      contentType: item.contentType,
      contentSource: item.contentSource,
      isFree: item.isFree,
      priceUsd: Number(item.priceUsd ?? 0),
      priceUzs: Number(item.priceUsd ?? 0),
      sourceUrl: item.sourceUrl,
      coverImageKey: item.coverImageKey,
      publishStatus: item.publishStatus,
      wordCount: item.wordCount,
      uniqueWordCount: item.uniqueWordCount,
      salesCount: item.salesCount,
      license: item.license,
      chapters: previewFromSegments(
        item.segments.map((s) => ({
          segmentIndex: s.segmentIndex,
          chapterIndex: s.chapterIndex,
          chapterTitle: s.chapterTitle ?? s.title ?? 'Chapter',
          pageIndex: s.pageIndex,
          title: s.title ?? 'Page',
          plainText: s.plainText,
          tokenMap: s.tokenMap,
          sentenceMap: s.sentenceMap,
          wordCount: s.wordCount,
        })),
      ),
    };
  }

  async getContentReader(id: string) {
    const item = await this.prisma.contentItem.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        author: true,
        language: true,
        cefrLevel: true,
        wordCount: true,
        publishStatus: true,
        segments: {
          select: {
            id: true,
            segmentIndex: true,
            chapterIndex: true,
            chapterTitle: true,
            pageIndex: true,
            title: true,
            wordCount: true,
          },
          orderBy: { segmentIndex: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Content not found');
    return item;
  }

  async getContentReaderPage(id: string, from = 0) {
    const exists = await this.prisma.contentItem.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Content not found');
    const page = await this.prisma.contentSegment.findFirst({
      where: { contentId: id, segmentIndex: Number.isFinite(from) ? from : 0 },
      select: {
        id: true,
        segmentIndex: true,
        chapterIndex: true,
        chapterTitle: true,
        pageIndex: true,
        title: true,
        wordCount: true,
        plainText: true,
      },
    });
    if (!page) throw new NotFoundException('Page not found');
    return page;
  }

  async uploadContentCover(id: string, file: Express.Multer.File) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content not found');
    const extByMime: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const ext = extByMime[file.mimetype];
    if (!ext) throw new BadRequestException('Use a JPG, PNG, or WebP image.');
    assertJpegPngOrWebp(file, 'Cover');
    if (file.size > 4 * 1024 * 1024) {
      throw new BadRequestException('Cover must be 4 MB or smaller.');
    }
    const root = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
    const dir = join(root, 'covers');
    await mkdir(dir, { recursive: true });
    const fileName = `${id}.${ext}`;
    await writeFile(join(dir, fileName), file.buffer);
    const coverImageKey = `/uploads/covers/${fileName}?v=${Date.now()}`;
    return this.prisma.contentItem.update({
      where: { id },
      data: { coverImageKey },
      select: { id: true, coverImageKey: true },
    });
  }

  async updateContent(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content not found');

    if (body.language !== undefined) {
      await assertEnabledLanguage(this.prisma, String(body.language), 'Content language');
    }

    const pricing =
      body.isFree !== undefined ||
      body.priceUsd !== undefined ||
      body.priceUzs !== undefined ||
      body.price !== undefined ||
      body.pricing !== undefined
        ? this.parseContentPricing({
            isFree: body.isFree ?? existing.isFree,
            priceUsd: body.priceUsd ?? body.priceUzs ?? body.price ?? existing.priceUsd,
            pricing: body.pricing,
          })
        : null;

    const nextTitle =
      body.title !== undefined ? String(body.title).trim() || existing.title : undefined;
    const nextAuthor =
      body.author !== undefined
        ? String(body.author).trim() || existing.author || existing.subtitle || undefined
        : undefined;

    return this.prisma.contentItem.update({
      where: { id },
      data: {
        title: nextTitle,
        author: nextAuthor,
        subtitle: nextAuthor,
        description: body.description !== undefined ? String(body.description) : undefined,
        genre: body.genre !== undefined ? String(body.genre) : undefined,
        language: body.language !== undefined ? (body.language as never) : undefined,
        contentType: body.contentType !== undefined ? (body.contentType as ContentType) : undefined,
        cefrLevel: body.cefrLevel !== undefined ? (body.cefrLevel as never) : undefined,
        publishStatus: body.publishStatus !== undefined ? (body.publishStatus as PublishStatus) : undefined,
        contentSource: body.contentSource !== undefined ? (body.contentSource as ContentSource) : undefined,
        sourceUrl: body.sourceUrl !== undefined ? String(body.sourceUrl) : undefined,
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
    return this.deleteContent(id);
  }

  async deleteContent(id: string) {
    const existing = await this.prisma.contentItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Content not found');
    if (
      existing.contentSource === ContentSource.user_import ||
      existing.contentType === ContentType.user_import
    ) {
      throw new BadRequestException('Learner imports are managed from User Imports, not the catalog.');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.userVocabulary.updateMany({
        where: { contentId: id },
        data: { contentId: null, contextSegmentId: null },
      });
      await tx.practiceSession.updateMany({
        where: { contentId: id },
        data: { contentId: null, segmentId: null },
      });
      await tx.userImport.updateMany({ where: { contentId: id }, data: { contentId: null } });
      await tx.ingestionJob.updateMany({ where: { contentId: id }, data: { contentId: null } });
      await tx.contentItem.updateMany({ where: { parentContentId: id }, data: { parentContentId: null } });
      await tx.contentItem.delete({ where: { id } });
    });

    const cover = existing.coverImageKey?.split('?')[0] ?? '';
    const match = cover.match(/^\/uploads\/covers\/([^/]+)$/);
    if (match) {
      const root = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
      await unlink(join(root, 'covers', match[1])).catch(() => undefined);
    }

    return { deleted: true, id, title: existing.title };
  }

  async importPricing(range = '12m') {
    const months = range === '3m' ? 3 : range === '6m' ? 6 : 12;
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const monthStart = new Date(Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth(), 1));
    const rangeStart = new Date(
      Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth() - (months - 1), 1),
    );
    const priorStart = new Date(
      Date.UTC(dayStart.getUTCFullYear(), dayStart.getUTCMonth() - (months * 2 - 1), 1),
    );
    const priorEnd = new Date(rangeStart.getTime() - 1);

    const [rules, tiers, freeLimits, importCount, paidRange, paidPrior, paidMonth, freeMonth, importsToday] =
      await Promise.all([
        this.prisma.importPricingRule.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.prisma.importPageTier.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.getImportFreeLimits(),
        this.prisma.userImport.count(),
        this.prisma.importPayment
          .aggregate({
            where: { status: 'paid', amountTiyins: { gt: 0 }, paidAt: { gte: rangeStart } },
            _sum: { amountTiyins: true },
            _count: true,
          })
          .catch(() => ({ _sum: { amountTiyins: 0 }, _count: 0 })),
        this.prisma.importPayment
          .aggregate({
            where: {
              status: 'paid',
              amountTiyins: { gt: 0 },
              paidAt: { gte: priorStart, lte: priorEnd },
            },
            _sum: { amountTiyins: true },
          })
          .catch(() => ({ _sum: { amountTiyins: 0 } })),
        this.prisma.importPayment
          .aggregate({
            where: { status: 'paid', amountTiyins: { gt: 0 }, paidAt: { gte: monthStart } },
            _sum: { amountTiyins: true },
            _count: true,
          })
          .catch(() => ({ _sum: { amountTiyins: 0 }, _count: 0 })),
        this.prisma.importPayment
          .count({
            where: { status: 'paid', amountTiyins: 0, paidAt: { gte: monthStart } },
          })
          .catch(() => 0),
        this.prisma.userImport.count({ where: { createdAt: { gte: dayStart } } }),
      ]);

    const revenueUzs = (paidRange._sum.amountTiyins ?? 0) / 100;
    const priorUzs = (paidPrior._sum.amountTiyins ?? 0) / 100;
    const revenueGrowthPct =
      priorUzs > 0
        ? Number((((revenueUzs - priorUzs) / priorUzs) * 100).toFixed(1))
        : revenueUzs > 0
          ? 100
          : 0;

    return {
      range,
      currency: 'UZS',
      atmosConfigured: Boolean(
        process.env.ATMOS_CONSUMER_KEY && process.env.ATMOS_STORE_ID,
      ),
      paymentGatewayEnabled: ['true', '1', 'yes', 'on'].includes(
        (process.env.PAYMENT_GATEWAY_ENABLED ?? '').trim().toLowerCase(),
      ),
      atmosMinAmountSom: atmosMinAmountSom(),
      stats: {
        totalImportsToday: importsToday,
        importsGrowthPct: 0,
        revenueFromImports: revenueUzs,
        revenueGrowthPct,
        priorRevenueFromImports: priorUzs,
        freeImportsUsed: freeMonth,
        freeImportsPool: 0,
        freeUsedPct: 0,
        conversionPct: 0,
        conversionGrowthPct: 0,
        realImportCount: importCount,
        paidImportsThisMonth: paidMonth._count,
        paidImportsInRange: paidRange._count,
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
      // NOTE: ImportPageTier.priceUsd column actually stores UZS (soʻm) amounts, not USD.
      // The column name is a legacy misnomer kept for backward compatibility.
      // Always use `priceUzs` in new code — `priceUsd` is exposed only for legacy clients.
      // See schema.prisma doc-comment and docs/E2E_AUDIT_REPORT.md #9 for context.
      tiers: tiers.map((t) => this.mapImportPageTier(t)),
      pageTierGaps: describePageTierGaps(tiers),
      freeLimits,
    };
  }

  async updateImportPricingRules(body: { rules?: Array<Record<string, unknown>> }) {
    const rules = body.rules ?? [];
    for (const rule of rules) {
      const label = String(rule.label ?? rule.key ?? 'Price');
      if (rule.pricePerImport !== undefined) {
        assertAtmosMinPriceSom(Number(rule.pricePerImport), `${label} — price per import`);
      }
      if (rule.pricePerPage !== undefined) {
        assertAtmosMinPriceSom(Number(rule.pricePerPage), `${label} — price per page`);
      }
    }
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

  private mapImportPageTier(t: {
    id: string;
    label: string;
    minPages: number;
    maxPages: number | null;
    priceUsd: unknown;
    sortOrder: number;
  }) {
    const priceUzs = Number(t.priceUsd);
    return {
      id: t.id,
      label: t.label,
      minPages: t.minPages,
      maxPages: t.maxPages,
      /** @deprecated Use priceUzs — this field name is misleading (stores UZS, not USD). */
      priceUsd: priceUzs,
      priceUzs,
      sortOrder: t.sortOrder,
    };
  }

  private parsePageTierRange(body: Record<string, unknown>, fallbackMin?: number) {
    const minPages = Math.floor(Number(body.minPages ?? fallbackMin ?? 1));
    if (!Number.isFinite(minPages) || minPages < 1) {
      throw new BadRequestException('Each tier needs a minimum of at least 1 page.');
    }
    const maxRaw = body.maxPages;
    const maxPages =
      maxRaw === null || maxRaw === undefined || maxRaw === ''
        ? null
        : Math.floor(Number(maxRaw));
    if (maxPages != null && (!Number.isFinite(maxPages) || maxPages < minPages)) {
      throw new BadRequestException('Max pages must be empty (unlimited) or ≥ min pages.');
    }
    return { minPages, maxPages };
  }

  private parsePageTierPrice(body: Record<string, unknown>) {
    const raw =
      body.priceUzs !== undefined
        ? Number(body.priceUzs)
        : body.priceUsd !== undefined
          ? Number(body.priceUsd)
          : undefined;
    if (raw === undefined) return undefined;
    if (!Number.isFinite(raw) || raw < 0) {
      throw new BadRequestException('Price must be a non-negative UZS amount.');
    }
    return raw;
  }

  private async reorderImportPageTiers() {
    const tiers = await this.prisma.importPageTier.findMany({
      orderBy: [{ minPages: 'asc' }, { sortOrder: 'asc' }],
    });
    await Promise.all(
      tiers.map((tier, index) =>
        this.prisma.importPageTier.update({
          where: { id: tier.id },
          data: { sortOrder: index + 1 },
        }),
      ),
    );
  }

  async createImportPageTier(body: Record<string, unknown>) {
    const { minPages, maxPages } = this.parsePageTierRange(body);
    const price = this.parsePageTierPrice(body) ?? 0;
    const label = String(body.label ?? '').trim() || defaultPageTierLabel(minPages, maxPages);
    assertAtmosMinPriceSom(price, `Page tier "${label}"`);
    const count = await this.prisma.importPageTier.count();
    const created = await this.prisma.importPageTier.create({
      data: {
        label,
        minPages,
        maxPages,
        priceUsd: price,
        sortOrder: count + 1,
      },
    });
    await this.reorderImportPageTiers();
    const next = await this.prisma.importPageTier.findUnique({ where: { id: created.id } });
    return this.mapImportPageTier(next ?? created);
  }

  async updateImportPageTier(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.importPageTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page tier not found');
    const range =
      body.minPages !== undefined || body.maxPages !== undefined
        ? this.parsePageTierRange(body, existing.minPages)
        : null;
    const price = this.parsePageTierPrice(body);
    const labelRaw = body.label !== undefined ? String(body.label).trim() : undefined;
    const nextMin = range?.minPages ?? existing.minPages;
    const nextMax = range ? range.maxPages : existing.maxPages;
    const label = labelRaw || existing.label || defaultPageTierLabel(nextMin, nextMax);
    if (price !== undefined) {
      assertAtmosMinPriceSom(price, `Page tier "${label}"`);
    }
    await this.prisma.importPageTier.update({
      where: { id },
      data: {
        label,
        minPages: range?.minPages,
        maxPages: range ? range.maxPages : undefined,
        priceUsd: price,
      },
    });
    await this.reorderImportPageTiers();
    const next = await this.prisma.importPageTier.findUnique({ where: { id } });
    return this.mapImportPageTier(next ?? existing);
  }

  async deleteImportPageTier(id: string) {
    const existing = await this.prisma.importPageTier.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Page tier not found');
    await this.prisma.importPageTier.delete({ where: { id } });
    await this.reorderImportPageTiers();
    return { deleted: true, id };
  }

  async getImportFreeLimits() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } });
    const defaults = {
      dailyFreeImportsPerUser: 3,
      monthlyFreePageLimit: 50,
      allowedFormats: ['article', 'news'] as string[],
      resetCycle: 'monthly',
      allowRollover: false,
    };
    if (!row?.value || typeof row.value !== 'object') return defaults;
    const merged = { ...defaults, ...(row.value as object) } as typeof defaults;
    return {
      ...merged,
      allowedFormats: normalizeAllowedFormats(merged.allowedFormats),
      resetCycle: ['daily', 'monthly', 'yearly'].includes(merged.resetCycle) ? merged.resetCycle : 'monthly',
      allowRollover: false,
    };
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
        ? normalizeAllowedFormats(body.allowedFormats)
        : current.allowedFormats,
      resetCycle: body.resetCycle !== undefined ? String(body.resetCycle) : current.resetCycle,
      allowRollover: false,
    };
    await this.prisma.platformSetting.upsert({
      where: { key: 'importFreeLimits' },
      update: { value: next as never },
      create: { key: 'importFreeLimits', value: next as never },
    });
    await this.prisma.subscriptionPlan.updateMany({
      where: { tier: 'free' },
      data: { importLimit: Math.max(0, Math.floor(next.dailyFreeImportsPerUser)) },
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

  private analyticsWindow(range = '30d') {
    const end = new Date();
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const priorEnd = new Date(start);
    priorEnd.setMilliseconds(priorEnd.getMilliseconds() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setHours(0, 0, 0, 0);
    priorStart.setDate(priorStart.getDate() - (days - 1));
    return { start, end, priorStart, priorEnd, days };
  }

  private async activeLearnerIds(start: Date, end: Date) {
    const [sessions, vocabs, imports] = await Promise.all([
      this.prisma.readingSession.findMany({
        where: { startedAt: { gte: start, lte: end }, user: liveLearnerWhere() },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.userVocabulary.findMany({
        where: { createdAt: { gte: start, lte: end }, user: liveLearnerWhere() },
        select: { userId: true },
        distinct: ['userId'],
      }),
      this.prisma.userImport.findMany({
        where: { createdAt: { gte: start, lte: end }, user: liveLearnerWhere() },
        select: { userId: true },
        distinct: ['userId'],
      }),
    ]);
    return new Set([...sessions, ...vocabs, ...imports].map((row) => row.userId));
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
    await this.purgeSeedSupportTickets();
    const [campaigns, tickets] = await Promise.all([
      this.prisma.notificationCampaign.findMany({
        where: { channel: { in: [...PUSH_CAMPAIGN_CHANNELS] } },
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

  private aiPriorBounds(range = 'today') {
    const { start } = this.aiDateBounds(range);
    const days = range === '7d' ? 7 : 1;
    const priorEnd = new Date(start);
    priorEnd.setMilliseconds(priorEnd.getMilliseconds() - 1);
    const priorStart = new Date(priorEnd);
    priorStart.setHours(0, 0, 0, 0);
    priorStart.setDate(priorStart.getDate() - (days - 1));
    return { start: priorStart, end: priorEnd };
  }

  /** Drop leftover Figma / admin / QA usage rows once so live KPIs are not theater. */
  private async purgeSeedAiUsage() {
    const key = 'aiUsageSeedPurged';
    const done = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (done) return;
    await this.prisma.aiUsageDaily.deleteMany({
      where: {
        OR: [
          { user: syntheticUserEmailWhere() },
          { user: { adminProfile: { isNot: null } } },
          { lookupCount: { gte: 1000 } },
        ],
      },
    });
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: { at: new Date().toISOString() } as never },
      create: { key, value: { at: new Date().toISOString() } as never },
    });
  }

  async aiUsage(range = 'today') {
    await this.purgeSeedAiUsage();
    const aiSettings = await this.resolveAiSettings();
    const { start, end } = this.aiDateBounds(range);
    const prior = this.aiPriorBounds(range);
    const liveUsage = { user: liveLearnerWhere() };

    const chartStart = new Date();
    chartStart.setHours(0, 0, 0, 0);
    chartStart.setDate(chartStart.getDate() - 6);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [rows, priorAgg, monthRows, chartRows, todayRows] = await Promise.all([
      this.prisma.aiUsageDaily.findMany({
        where: { usageDate: { gte: start, lte: end }, ...liveUsage },
        include: { user: { select: { id: true, email: true, displayName: true } } },
      }),
      this.prisma.aiUsageDaily.aggregate({
        where: { usageDate: { gte: prior.start, lte: prior.end }, ...liveUsage },
        _sum: { lookupCount: true },
      }),
      this.prisma.aiUsageDaily.findMany({
        where: {
          usageDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
          ...liveUsage,
        },
        select: { userId: true, lookupCount: true },
      }),
      this.prisma.aiUsageDaily.findMany({
        where: { usageDate: { gte: chartStart }, ...liveUsage },
        select: { usageDate: true, lookupCount: true, tokensUsed: true },
      }),
      this.prisma.aiUsageDaily.findMany({
        where: { usageDate: todayStart, ...liveUsage },
        select: { lookupCount: true, quizCount: true },
      }),
    ]);

    const lookups = rows.reduce((sum, r) => sum + r.lookupCount, 0);
    const quizzes = rows.reduce((sum, r) => sum + r.quizCount, 0);
    const tokens = rows.reduce((sum, r) => sum + Number(r.tokensUsed ?? 0), 0);
    const uniqueUsers = new Set(rows.map((r) => r.userId)).size;
    const avgLookupsPerUser = uniqueUsers > 0 ? lookups / uniqueUsers : 0;
    const priorLookups = priorAgg._sum.lookupCount ?? 0;
    const growthPct =
      priorLookups > 0
        ? Number((((lookups - priorLookups) / priorLookups) * 100).toFixed(1))
        : lookups > 0
          ? 100
          : 0;

    const todayLookups = todayRows.reduce((sum, r) => sum + r.lookupCount, 0);
    const todayQuizzes = todayRows.reduce((sum, r) => sum + r.quizCount, 0);
    const todayPlatformUsed = todayLookups + todayQuizzes;
    const userQuota = aiSettings.defaultUserQuota;
    const usersAtQuota =
      userQuota > 0 && userQuota < 1_000_000
        ? todayRows.filter((r) => r.lookupCount >= userQuota).length
        : 0;

    const monthByUser = new Map<string, number>();
    for (const r of monthRows) {
      monthByUser.set(r.userId, (monthByUser.get(r.userId) ?? 0) + r.lookupCount);
    }

    const byUser = new Map<
      string,
      { email: string; displayName: string | null; lookups: number; tokens: number }
    >();
    for (const r of rows) {
      const existing = byUser.get(r.userId);
      if (existing) {
        existing.lookups += r.lookupCount;
        existing.tokens += Number(r.tokensUsed ?? 0);
      } else {
        byUser.set(r.userId, {
          email: r.user.email,
          displayName: r.user.displayName,
          lookups: r.lookupCount,
          tokens: Number(r.tokensUsed ?? 0),
        });
      }
    }

    const paidImportUsers =
      byUser.size === 0
        ? []
        : await this.prisma.importPayment.findMany({
            where: { status: 'paid', userId: { in: [...byUser.keys()] } },
            select: { userId: true },
            distinct: ['userId'],
          });
    const payAsYouGoIds = new Set(paidImportUsers.map((r) => r.userId));

    const topUsers = [...byUser.entries()]
      .sort((a, b) => b[1].lookups - a[1].lookups)
      .slice(0, 10)
      .map(([id, u]) => ({
        user: { id, email: u.email, displayName: u.displayName },
        plan: payAsYouGoIds.has(id) ? 'Pay as you go' : 'Free',
        lookups: u.lookups,
        monthLookups: monthByUser.get(id) ?? u.lookups,
        cost: 0,
        status: 'Active',
        tokens: u.tokens,
      }));

    const dayMap = new Map<string, { lookups: number; tokens: number }>();
    for (const r of chartRows) {
      const key = r.usageDate.toISOString().slice(0, 10);
      const cur = dayMap.get(key) ?? { lookups: 0, tokens: 0 };
      cur.lookups += r.lookupCount;
      cur.tokens += Number(r.tokensUsed ?? 0);
      dayMap.set(key, cur);
    }

    const today = new Date();
    const daily = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      const key = d.toISOString().slice(0, 10);
      const hit = dayMap.get(key);
      return {
        date: key,
        lookups: hit?.lookups ?? 0,
        tokens: hit?.tokens ?? 0,
      };
    });

    const chartPoints = daily.map((d) => ({
      label: new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' }),
      value: d.lookups,
    }));
    const dailyLookups = daily.map((d) => d.lookups);

    const totalCalls = lookups + quizzes;
    const featureUsage: Array<{ name: string; pct: number; color: string }> = [];
    if (lookups > 0) {
      featureUsage.push({
        name: 'Word Lookup',
        pct: totalCalls > 0 ? Math.round((lookups / totalCalls) * 100) : 0,
        color: '#6c1d95',
      });
    }
    if (quizzes > 0) {
      featureUsage.push({
        name: 'Quiz Gen',
        pct: totalCalls > 0 ? Math.round((quizzes / totalCalls) * 100) : 0,
        color: '#a855f7',
      });
    }

    return {
      range,
      source: 'live' as const,
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
        tokens,
        uniqueUsers,
        priorLookups,
        growthPct,
        avgLookupsPerUser: Number(avgLookupsPerUser.toFixed(1)),
        avgLookupsTarget: aiSettings.defaultUserQuota,
        apiCostToday: 0,
        avgCostPerLookup: 0,
        rateLimitedUsers: usersAtQuota,
        flagAlerts: usersAtQuota,
        todayLookups,
        todayPlatformUsed,
        usersAtQuota,
      },
      allTime: {
        lookups,
        quizzes,
        tokens,
      },
      daily,
      dailyLookups,
      hourlyLookups: [] as number[],
      chartPoints,
      chartKind: 'daily' as const,
      featureUsage,
      insight: aiSettings.enabled
        ? uniqueUsers > 0
          ? `Live usage from ${uniqueUsers} learner${uniqueUsers === 1 ? '' : 's'} in this range. Model ${aiSettings.lookupModel}.`
          : 'No learner AI lookups in this range yet.'
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

  async analytics(range = '30d') {
    const { start, end, priorStart, priorEnd, days } = this.analyticsWindow(range);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const live = { user: liveLearnerWhere() };
    const colors = ['#6c1d95', '#10b981', '#f97316', '#3b82f6', '#ef4444', '#14b8a6'];

    const [
      todayIds,
      yesterdayIds,
      rangeIds,
      priorIds,
      sessions,
      sessionAgg,
      priorSessionAgg,
      langGroups,
      cefrGroups,
      vocabCount,
      importCount,
      aiLookups,
      paidRange,
      paidPrior,
    ] = await Promise.all([
      this.activeLearnerIds(todayStart, end),
      this.activeLearnerIds(yesterdayStart, new Date(todayStart.getTime() - 1)),
      this.activeLearnerIds(start, end),
      this.activeLearnerIds(priorStart, priorEnd),
      this.prisma.readingSession.findMany({
        where: { startedAt: { gte: start, lte: end }, ...live },
        select: { startedAt: true, durationSeconds: true },
      }),
      this.prisma.readingSession.aggregate({
        where: { startedAt: { gte: start, lte: end }, durationSeconds: { gt: 0 }, ...live },
        _avg: { durationSeconds: true },
        _count: true,
      }),
      this.prisma.readingSession.aggregate({
        where: { startedAt: { gte: priorStart, lte: priorEnd }, durationSeconds: { gt: 0 }, ...live },
        _avg: { durationSeconds: true },
      }),
      this.prisma.userTargetLanguage.groupBy({
        by: ['targetLanguage'],
        where: { user: liveLearnerWhere() },
        _count: { _all: true },
      }),
      this.prisma.userTargetLanguage.groupBy({
        by: ['cefrLevel'],
        where: { user: liveLearnerWhere() },
        _count: { _all: true },
      }),
      this.prisma.userVocabulary.count({
        where: { createdAt: { gte: start, lte: end }, ...live },
      }),
      this.prisma.userImport.count({
        where: { createdAt: { gte: start, lte: end }, ...live },
      }),
      this.prisma.aiUsageDaily.aggregate({
        where: { usageDate: { gte: start, lte: end }, ...live },
        _sum: { lookupCount: true },
      }),
      this.prisma.importPayment
        .aggregate({
          where: { status: 'paid', amountTiyins: { gt: 0 }, paidAt: { gte: start, lte: end } },
          _sum: { amountTiyins: true },
        })
        .catch(() => ({ _sum: { amountTiyins: 0 } })),
      this.prisma.importPayment
        .aggregate({
          where: { status: 'paid', amountTiyins: { gt: 0 }, paidAt: { gte: priorStart, lte: priorEnd } },
          _sum: { amountTiyins: true },
        })
        .catch(() => ({ _sum: { amountTiyins: 0 } })),
    ]);

    const dau = todayIds.size;
    const yesterday = yesterdayIds.size;
    const dauGrowthPct =
      yesterday > 0 ? Number((((dau - yesterday) / yesterday) * 100).toFixed(1)) : dau > 0 ? 100 : 0;

    const avgSessionMin = Number(((sessionAgg._avg.durationSeconds ?? 0) / 60).toFixed(1));
    const priorAvgMin = (priorSessionAgg._avg.durationSeconds ?? 0) / 60;
    const avgSessionGrowthPct =
      priorAvgMin > 0
        ? Number((((avgSessionMin - priorAvgMin) / priorAvgMin) * 100).toFixed(1))
        : avgSessionMin > 0
          ? 100
          : 0;

    const returning = [...rangeIds].filter((id) => priorIds.has(id)).length;
    const retentionPct =
      priorIds.size > 0 ? Number(((returning / priorIds.size) * 100).toFixed(1)) : 0;

    const revenue = (paidRange._sum.amountTiyins ?? 0) / 100;
    const priorRevenue = (paidPrior._sum.amountTiyins ?? 0) / 100;
    const revenueGrowthPct =
      priorRevenue > 0
        ? Number((((revenue - priorRevenue) / priorRevenue) * 100).toFixed(1))
        : revenue > 0
          ? 100
          : 0;

    const hourly = Array.from({ length: 24 }, () => 0);
    const dayMap = new Map<string, number>();
    for (const s of sessions) {
      hourly[s.startedAt.getUTCHours()] += 1;
      const key = s.startedAt.toISOString().slice(0, 10);
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1);
    }
    const chartDays = Math.min(days, 14);
    const engagementByDay = Array.from({ length: chartDays }, (_, i) => {
      const d = new Date(end);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (chartDays - 1 - i));
      const key = d.toISOString().slice(0, 10);
      return {
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value: dayMap.get(key) ?? 0,
      };
    });

    const langTotal = langGroups.reduce((sum, g) => sum + g._count._all, 0);
    const languageDistribution = langGroups
      .map((g, i) => ({
        name: LANGUAGE_META[g.targetLanguage]?.label ?? g.targetLanguage,
        code: g.targetLanguage,
        count: g._count._all,
        pct: langTotal > 0 ? Math.round((g._count._all / langTotal) * 100) : 0,
        color: colors[i % colors.length],
      }))
      .sort((a, b) => b.count - a.count);

    const cefrMap = new Map(cefrGroups.map((g) => [g.cefrLevel, g._count._all]));
    const cefrDistribution = CEFR_LEVELS.map((level) => ({
      level: level.toUpperCase(),
      count: cefrMap.get(level) ?? 0,
    }));

    const readingCount = sessions.length;
    const lookups = aiLookups._sum.lookupCount ?? 0;
    const featureTotal = readingCount + vocabCount + lookups + importCount;
    const featureUsage = [
      { name: 'Reading', count: readingCount, color: '#6c1d95' },
      { name: 'Vocabulary', count: vocabCount, color: '#10b981' },
      { name: 'AI lookups', count: lookups, color: '#f97316' },
      { name: 'Imports', count: importCount, color: '#3b82f6' },
    ]
      .filter((f) => f.count > 0)
      .map((f) => ({
        name: f.name,
        pct: featureTotal > 0 ? Math.round((f.count / featureTotal) * 100) : 0,
        color: f.color,
      }));

    return {
      range,
      source: 'live' as const,
      kpis: {
        dau,
        dauGrowthPct,
        avgSessionMin,
        avgSessionGrowthPct,
        lessonCompletionPct: 0,
        lessonCompletionDeltaPct: 0,
        retentionPct,
        retentionGrowthPct: 0,
        revenue,
        revenueGrowthPct,
        users: rangeIds.size,
        sessions: readingCount,
        vocab: vocabCount,
        content: 0,
        readingHours: Number(((sessionAgg._avg.durationSeconds ?? 0) * (sessionAgg._count ?? 0) / 3600).toFixed(1)),
        priorDau: yesterday,
        priorRevenue,
      },
      engagementByHour: hourly,
      engagementByDay,
      languageDistribution,
      cefrDistribution,
      featureUsage,
      byLanguage: languageDistribution,
    };
  }

  async languages() {
    await ensureLanguageCatalog(this.prisma);
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

    const codes = [...APP_LANGUAGES];
    const languages = codes
      .map((code, idx) => {
        const row = byCode.get(code);
        const contentCount = contentByLang.get(code) ?? 0;
        const learnerCount = learnersByLang.get(code) ?? 0;
        const cefrCoverage = Math.round(((cefrLevelsByLang.get(code)?.size ?? 0) / 6) * 100);
        const isEnabled = row?.isEnabled ?? (LIVE_LANGUAGES as readonly string[]).includes(code);
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
    const totalContentItems = enabled.reduce((s, l) => s + l.contentCount, 0);
    const avgCefrCoverage = enabled.length
      ? Math.round(enabled.reduce((s, l) => s + l.cefrCoverage, 0) / enabled.length)
      : 0;

    return {
      stats: {
        supported: enabled.length,
        totalContentItems,
        avgCefrCoverage,
      },
      languages,
      availableToAdd: languages.filter((l) => !l.isEnabled),
    };
  }

  async addLanguage(code: string) {
    const normalized = code.trim().toLowerCase();
    if (!isAppLanguageCode(normalized)) {
      throw new BadRequestException(
        `Unsupported language code "${code}". Allowed: ${APP_LANGUAGES.join(', ')}.`,
      );
    }
    return this.updateLanguage(normalized, { isEnabled: true, status: 'Active' });
  }

  async removeLanguage(code: string) {
    const normalized = code.trim().toLowerCase();
    if (!isAppLanguageCode(normalized)) {
      throw new BadRequestException(`Unknown language "${code}".`);
    }
    const enabled = await this.prisma.languageCatalog.count({
      where: { isEnabled: true, code: { in: [...APP_LANGUAGES] } },
    });
    const current = await this.prisma.languageCatalog.findUnique({ where: { code: normalized } });
    if (current?.isEnabled && enabled <= 1) {
      throw new BadRequestException('Keep at least one enabled language.');
    }
    return this.updateLanguage(normalized, { isEnabled: false, status: 'Draft' });
  }

  async updateLanguage(code: string, body: { isEnabled?: boolean; status?: string }) {
    const normalized = code.trim().toLowerCase();
    if (!isAppLanguageCode(normalized)) {
      throw new BadRequestException(`Unknown language "${code}".`);
    }
    if (body.isEnabled === false) {
      const enabled = await this.prisma.languageCatalog.count({
        where: {
          isEnabled: true,
          code: { in: APP_LANGUAGES.filter((c) => c !== normalized) },
        },
      });
      if (enabled < 1) {
        throw new BadRequestException('Keep at least one enabled language.');
      }
    }
    const isEnabled = body.isEnabled;
    const status =
      body.status ??
      (isEnabled === false ? 'Draft' : isEnabled === true ? 'Active' : undefined);
    return this.prisma.languageCatalog.upsert({
      where: { code: normalized },
      update: {
        isEnabled,
        status,
      },
      create: {
        code: normalized,
        name: this.langLabel(normalized),
        nativeName: this.langNative(normalized),
        flagEmoji: this.langFlag(normalized),
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
    const [streakers, streakAgg] = await Promise.all([
      this.prisma.user.count({ where: { ...liveLearnerWhere(), streakCount: { gte: 7 } } }),
      this.prisma.user.aggregate({
        where: liveLearnerWhere(),
        _avg: { streakCount: true },
      }),
    ]);

    const catalogPoints = achievements.reduce((sum, a) => sum + (a.points ?? 0), 0);
    const avgStreakDays = Number((streakAgg._avg.streakCount ?? 0).toFixed(1));

    return {
      stats: {
        achievements: achievements.length,
        activeAchievements: achievements.filter((a) => a.isActive).length,
        streakers,
        vocabMasters: 0,
        activeReaders: 0,
        catalogPoints,
        avgStreakDays,
        totalEarned: 0,
      },
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

  createAchievement(_body: Record<string, unknown>) {
    throw new BadRequestException(
      'Custom achievements are not available yet. Enable or disable the seeded catalog badges instead.',
    );
  }

  async updateAchievement(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.achievement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Achievement not found');
    return this.prisma.achievement.update({
      where: { id },
      data: {
        isActive: typeof body.isActive === 'boolean' ? body.isActive : undefined,
      },
    });
  }

  /** Drop leftover email / Premium-upsell seed campaigns once. */
  private async purgeSeedCampaigns() {
    const key = 'notificationCampaignsLiveAligned';
    const done = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (done) return;
    await this.prisma.notificationCampaign.deleteMany({
      where: {
        OR: [
          { channel: CampaignChannel.email },
          { name: { in: ['Premium Upsell', 'Welcome Push', 'Streak Reminder'] } },
          { subject: 'Unlock unlimited AI lookups' },
        ],
      },
    });
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: { at: new Date().toISOString() } as never },
      create: { key, value: { at: new Date().toISOString() } as never },
    });
  }

  async notifications() {
    await this.purgeSeedCampaigns();
    const pushWhere = { channel: { in: [...PUSH_CAMPAIGN_CHANNELS] } };
    const campaigns = await this.prisma.notificationCampaign.findMany({
      where: pushWhere,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const [draft, scheduled, sent] = await Promise.all([
      this.prisma.notificationCampaign.count({ where: { ...pushWhere, status: 'draft' } }),
      this.prisma.notificationCampaign.count({ where: { ...pushWhere, status: 'scheduled' } }),
      this.prisma.notificationCampaign.count({ where: { ...pushWhere, status: 'sent' } }),
    ]);
    return { stats: { draft, scheduled, sent, total: campaigns.length }, campaigns };
  }

  createCampaign(adminId: string, body: Record<string, unknown>) {
    const channel = String(body.channel ?? 'push').toLowerCase();
    if (channel === 'email') {
      throw new BadRequestException('Email campaigns are not supported. Use a push notification instead.');
    }
    return this.prisma.notificationCampaign.create({
      data: {
        name: String(body.name ?? 'Untitled campaign').trim() || 'Untitled campaign',
        subject: String(body.subject ?? '').trim(),
        body: String(body.body ?? '').trim(),
        channel: CampaignChannel.push,
        status: (body.status as CampaignStatus) ?? CampaignStatus.draft,
        audience: normalizeCampaignAudience(body.audience),
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined,
        sentAt: body.status === 'sent' ? new Date() : undefined,
        createdById: adminId,
      },
    });
  }

  async updateCampaign(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.notificationCampaign.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Campaign not found');
    if (body.channel !== undefined && String(body.channel).toLowerCase() === 'email') {
      throw new BadRequestException('Email campaigns are not supported. Use a push notification instead.');
    }
    return this.prisma.notificationCampaign.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name) : undefined,
        subject: body.subject !== undefined ? String(body.subject) : undefined,
        body: body.body !== undefined ? String(body.body) : undefined,
        channel: CampaignChannel.push,
        audience: body.audience !== undefined ? normalizeCampaignAudience(body.audience) : undefined,
        status: body.status !== undefined ? (body.status as CampaignStatus) : undefined,
        scheduledAt: body.scheduledAt ? new Date(String(body.scheduledAt)) : undefined,
        sentAt: body.status === 'sent' ? new Date() : undefined,
      },
    });
  }

  /** Learners have no in-app ticket API — drop leftover Figma/seed rows once. */
  private async purgeSeedSupportTickets() {
    const key = 'supportTicketsSeedPurged';
    const done = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (done) return;
    await this.prisma.supportTicket.deleteMany({
      where: {
        OR: [
          {
            subject: {
              in: [
                'Import failed for EPUB',
                'Billing question',
                'Feature request: dark reader theme',
              ],
            },
          },
          { body: { contains: 'yearly Premium', mode: 'insensitive' } },
        ],
      },
    });
    await this.prisma.platformSetting.upsert({
      where: { key },
      update: { value: { at: new Date().toISOString() } as never },
      create: { key, value: { at: new Date().toISOString() } as never },
    });
  }

  async support() {
    await this.purgeSeedSupportTickets();
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

  createTicket(_body: Record<string, unknown>) {
    throw new BadRequestException(
      'Learners cannot submit in-app tickets yet. Contact is email-only (Settings → support email).',
    );
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
      supportEmail: 'support@gotchaa.uz',
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
    const defaults = defaultAiPlatformSettings();
    const nextBody = { ...body };
    if (nextBody[AI_SETTING_KEYS.defaultUserQuota] !== undefined) {
      nextBody[AI_SETTING_KEYS.defaultUserQuota] = coerceNonNegInt(
        nextBody[AI_SETTING_KEYS.defaultUserQuota],
        defaults.defaultUserQuota,
      );
    }
    if (nextBody[AI_SETTING_KEYS.dailyLimit] !== undefined) {
      nextBody[AI_SETTING_KEYS.dailyLimit] = coerceNonNegInt(
        nextBody[AI_SETTING_KEYS.dailyLimit],
        defaults.dailyLimit,
      );
    }
    const entries = Object.entries(nextBody).filter(
      ([key, value]) =>
        key !== ADMIN_METRICS_KEY && key !== 'aiConfigured' && value !== undefined,
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
    if (nextBody[AI_SETTING_KEYS.defaultUserQuota] !== undefined) {
      await this.prisma.subscriptionPlan.updateMany({
        where: { tier: 'free' },
        data: { aiDailyQuota: nextBody[AI_SETTING_KEYS.defaultUserQuota] as number },
      });
    }
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
    const current = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!current?.adminProfile) throw new NotFoundException('Admin account not found');

    if (dto.email) {
      const email = dto.email.trim().toLowerCase();
      if (email !== current.email) {
        throw new BadRequestException(
          'Admin login email cannot be changed here — it prevents lockouts. Use forgot password to reset your password, or run restore-admin on the server if locked out.',
        );
      }
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        displayName: dto.displayName?.trim() || undefined,
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

  /** Self-service password reset email for the signed-in admin (same token path as forgot-password). */
  async requestPasswordReset(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { adminProfile: true },
    });
    if (!user?.adminProfile) throw new NotFoundException('Admin account not found');
    if (!user.passwordHash) {
      throw new BadRequestException('This account has no password login to reset.');
    }
    return this.auth.adminTriggerPasswordReset(userId);
  }

  private mapUserRow(
    u: {
      id: string;
      email: string;
      displayName: string | null;
      avatarUrl: string | null;
      createdAt: Date;
      streakCount: number;
      targetLanguages: Array<{ targetLanguage: AppLanguage; cefrLevel: string; isPrimary: boolean }>;
      subscriptions: Array<{ status: string; plan: { name: string; tier: string } }>;
    },
    opts?: { payAsYouGo?: boolean },
  ) {
    const primary = u.targetLanguages.find((t) => t.isPrimary) ?? u.targetLanguages[0];
    const payAsYouGo = Boolean(opts?.payAsYouGo);
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
      billingTier: payAsYouGo ? 'Pay as you go' : 'Free',
      subscriptionStatus: u.subscriptions[0]?.status ?? 'none',
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
    return languageLabel(code);
  }

  private langNative(code: AppLanguage | string) {
    const meta = LANGUAGE_META[code as keyof typeof LANGUAGE_META];
    return meta?.nativeName ?? String(code);
  }

  private langFlag(code: AppLanguage | string) {
    return languageFlag(code);
  }
}
