import { Injectable, NotFoundException } from '@nestjs/common';
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

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  private async getMetrics(): Promise<FigmaAdminMetrics> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: ADMIN_METRICS_KEY } });
    if (row?.value && typeof row.value === 'object') {
      return { ...FIGMA_ADMIN_METRICS, ...(row.value as object) } as FigmaAdminMetrics;
    }
    return FIGMA_ADMIN_METRICS;
  }

  async dashboard() {
    const metrics = await this.getMetrics();
    const d = metrics.dashboard;
    const [publishedContent, userImports, moderationPending, ingestionQueued] = await Promise.all([
      this.prisma.contentItem.count({ where: { publishStatus: PublishStatus.published } }),
      this.prisma.userImport.count(),
      this.prisma.moderationQueue.count({ where: { status: 'pending' } }),
      this.prisma.ingestionJob.count({ where: { status: 'queued' } }),
    ]);

    return {
      users: d.users,
      publishedContent,
      userImports,
      moderationPending,
      ingestionQueued,
      activeSubscribers: d.activeSubscribers,
      mrr: d.mrr,
      mrrGrowthPct: d.mrrGrowthPct,
      aiLookupsToday: d.aiLookupsToday,
      aiLimit: d.aiLimit,
      aiUsagePct: d.aiUsagePct,
      userGrowthPct: d.userGrowthPct,
      conversionPct: d.conversionPct,
      aiUsageTotal: {
        tokensUsed: Math.round(d.aiLookupsToday * 32),
        lookupCount: d.aiLookupsToday,
        quizCount: Math.round(d.aiLookupsToday * 0.08),
      },
      userGrowth: [...d.userGrowth],
      revenueTrend: [...d.revenueTrend],
      revenueMomDelta: d.revenueMomDelta,
      aiCategories: d.aiCategories.map((c) => ({ ...c })),
      topPhrases: d.topPhrases.map((p) => ({ ...p })),
      contentByLevel: [],
      recentUsers: d.recentUsers.map((u) => ({ ...u })),
    };
  }

  async listUsers(q?: string, tier?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
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

    let rows = users.map((u) => ({
      ...this.mapUserRow(u),
      isAdmin: Boolean(u.adminProfile),
      adminRole: u.adminProfile?.role ?? null,
      vocabCount: u._count.vocabulary,
      sessionCount: u._count.readingSessions,
    }));

    if (tier) {
      rows = rows.filter((r) => r.billingTier.toLowerCase().includes(tier.toLowerCase()));
    }

    const metrics = await this.getMetrics();
    return {
      stats: {
        total: metrics.users.total,
        premium: metrics.users.premium,
        free: metrics.users.free,
        suspended: metrics.users.suspended,
      },
      users: rows,
    };
  }

  async updateUser(id: string, body: { displayName?: string; deleted?: boolean }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: {
        displayName: body.displayName,
        deletedAt: body.deleted === true ? new Date() : body.deleted === false ? null : undefined,
      },
    });
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
    return {
      total: c.total,
      published: c.published,
      draft: c.draft,
      review: c.review,
      archived: c.archived ?? 0,
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
      };
    });
  }

  async createContent(adminId: string, body: Record<string, unknown>) {
    const title = String(body.title ?? 'Untitled');
    const plainText = String(body.plainText ?? '');
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(plainText);

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

    return this.prisma.moderationQueue.update({
      where: { id },
      data: {
        status,
        notes,
        reviewerId,
        reviewedAt: new Date(),
      },
    });
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
      /bill|sub|premium|mrr|revenue|plan/i.test(query)
        ? [
            {
              id: 'subs',
              type: 'subscription' as const,
              title: 'Subscriptions & Revenue',
              subtitle: 'Plans, MRR, and recent transactions',
              href: '/subscriptions',
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
    const metrics = await this.getMetrics();
    const catalog = await this.prisma.languageCatalog.findMany();
    const byCode = new Map<string, (typeof catalog)[number]>(catalog.map((l) => [l.code, l]));
    const metaByCode = new Map<string, (typeof metrics.languages.catalog)[number]>(
      metrics.languages.catalog.map((l) => [l.code, l]),
    );

    // Union of Figma catalog + DB rows (e.g. Russian) so admin matches Prisma AppLanguage set.
    const codes = [
      ...new Set([
        ...metrics.languages.catalog.map((l) => l.code),
        ...catalog.map((l) => l.code),
      ]),
    ];

    const languages = codes
      .map((code) => {
        const meta = metaByCode.get(code);
        const row = byCode.get(code);
        return {
          code,
          name: row?.name ?? meta?.name ?? this.langLabel(code),
          nativeName: row?.nativeName ?? meta?.nativeName ?? this.langNative(code),
          flagEmoji: row?.flagEmoji ?? meta?.flagEmoji ?? this.langFlag(code),
          regionLabel: row?.regionLabel ?? meta?.region ?? null,
          status: row?.status ?? meta?.status ?? 'Active',
          cefrCoverage: row?.cefrCoverage ?? meta?.cefrCoverage ?? 0,
          learnerCount: row?.learnerCount ?? meta?.learnerCount ?? 0,
          contentCount: row?.contentCount ?? meta?.contentCount ?? 0,
          isEnabled: row?.isEnabled ?? meta?.isEnabled ?? true,
          sortOrder: row?.sortOrder ?? meta?.sortOrder ?? 99,
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);

    return {
      stats: {
        supported: metrics.languages.supported,
        supportedDelta: metrics.languages.supportedDelta,
        totalContentItems: metrics.languages.totalContentItems,
        contentDelta: metrics.languages.contentDelta,
        avgCefrCoverage: metrics.languages.avgCefrCoverage,
        cefrDelta: metrics.languages.cefrDelta,
        interfaceTranslations: metrics.languages.interfaceTranslations,
      },
      cefrThresholds: metrics.languages.cefrThresholds.map((t) => ({ ...t })),
      languages,
    };
  }

  async updateLanguage(code: string, body: { isEnabled?: boolean; status?: string }) {
    const meta = FIGMA_ADMIN_METRICS.languages.catalog.find((l) => l.code === code);
    return this.prisma.languageCatalog.upsert({
      where: { code },
      update: {
        isEnabled: body.isEnabled,
        status: body.status ?? (body.isEnabled === false ? 'Draft' : undefined),
      },
      create: {
        code,
        name: meta?.name ?? this.langLabel(code),
        nativeName: meta?.nativeName ?? this.langNative(code),
        flagEmoji: meta?.flagEmoji ?? this.langFlag(code),
        regionLabel: meta?.region,
        status: body.status ?? meta?.status ?? 'Active',
        cefrCoverage: meta?.cefrCoverage ?? 0,
        learnerCount: meta?.learnerCount ?? 0,
        contentCount: meta?.contentCount ?? 0,
        isEnabled: body.isEnabled ?? meta?.isEnabled ?? true,
        sortOrder: meta?.sortOrder ?? 99,
      },
    });
  }

  async levelTests() {
    const results = await this.prisma.placementResult.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...new Set(results.map((r) => r.userId))] } },
      select: { id: true, email: true, displayName: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const byLevel = await this.prisma.placementResult.groupBy({
      by: ['suggestedLevel'],
      _count: { _all: true },
      _avg: { score: true },
    });

    return {
      stats: {
        total: results.length
          ? await this.prisma.placementResult.count()
          : 0,
        avgScore:
          byLevel.length === 0
            ? 0
            : byLevel.reduce((s, r) => s + (r._avg.score ?? 0), 0) / byLevel.length,
        byLevel: byLevel.map((r) => ({
          level: r.suggestedLevel,
          count: r._count._all,
          avgScore: Number((r._avg.score ?? 0).toFixed(1)),
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
    const [streakers, vocabMasters, sessionUsers] = await Promise.all([
      this.prisma.user.count({ where: { streakCount: { gte: 7 }, deletedAt: null } }),
      this.prisma.userVocabulary.count({ where: { mastered: true } }),
      this.prisma.readingSession.groupBy({
        by: ['userId'],
        _count: { _all: true },
      }),
    ]);

    return {
      stats: {
        achievements: achievements.length,
        activeAchievements: achievements.filter((a) => a.isActive).length,
        streakers,
        vocabMasters,
        activeReaders: sessionUsers.filter((s) => s._count._all >= 5).length,
      },
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
