import { Injectable, Logger } from '@nestjs/common';
import { ContentSource, ContentType, PublishStatus } from '@prisma/client';
import { LANGUAGE_META } from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { liveLearnerWhere, isFigmaSampleDisplayName } from '../../common/production-users';
import { atmosMinAmountSom } from '../billing/atmos.client';
import { catalogPriceUzs } from '../content/catalog-access';
import { normalizeAllowedFormats } from '../../common/import-format';
import { effectiveStreakCount } from '../../services/streak.service';

const LIVE_LANGUAGE_CODES = ['en', 'ru', 'uz'] as const;
const UNLIMITED_THRESHOLD = 1_000_000;
const LANDING_CACHE_TTL_MS = 60_000;
const CATALOG_CAP = 12;
const READER_CAP = 6;
const READER_SCAN_CAP = 400;

/** Figma landing mock names — never treat as live top readers. */
const FIGMA_LANDING_DISPLAY_NAMES = new Set(
  [
    'Dilshod M.',
    'Dilshod M',
    'Shakhzoda K.',
    'Shakhzoda K',
    'Alisher U.',
    'Alisher U',
    'Alisher T.',
    'Alisher T',
  ].map((n) => n.toLowerCase()),
);

export type LandingCatalogItem = {
  id: string;
  slug: string;
  title: string;
  author: string | null;
  coverImageUrl: string | null;
  language: string;
  cefr: string;
  contentType: string;
  isFree: boolean;
  priceUzs: number;
};

export type LandingImportPricing = {
  currency: 'UZS';
  atmosMinAmountSom: number;
  freeLimits: {
    dailyFreeImportsPerUser: number;
    monthlyFreePageLimit: number;
    allowedFormats: string[];
    resetCycle: 'daily' | 'monthly' | 'yearly';
  };
  tiers: Array<{
    id: string;
    label: string;
    minPages: number;
    maxPages: number | null;
    priceUzs: number;
    sortOrder: number;
  }>;
};

export type LandingTopReader = {
  rank: number;
  displayName: string;
  initials: string;
  minutesRead: number;
  streakDays: number;
  wordsLearned: number;
};

export type LandingPayload = {
  generatedAt: string;
  stats: { learnerCount: number };
  languages: Array<{ code: string; name: string; nativeName: string; flagEmoji: string }>;
  catalog: { source: 'featured' | 'recent'; items: LandingCatalogItem[] };
  importPricing: LandingImportPricing;
  topReaders: LandingTopReader[];
};

const DEFAULT_FREE_LIMITS: LandingImportPricing['freeLimits'] = {
  dailyFreeImportsPerUser: 3,
  monthlyFreePageLimit: 50,
  allowedFormats: ['article', 'news'],
  resetCycle: 'monthly',
};

function emptyPricing(): LandingImportPricing {
  return {
    currency: 'UZS',
    atmosMinAmountSom: atmosMinAmountSom(),
    freeLimits: DEFAULT_FREE_LIMITS,
    tiers: [],
  };
}

function catalogWhere() {
  return {
    publishStatus: PublishStatus.published,
    contentSource: { not: ContentSource.user_import },
    contentType: { not: ContentType.user_import },
  };
}

function serializeCatalogItem(row: {
  id: string;
  slug: string;
  title: string;
  coverImageKey: string | null;
  language: string;
  cefrLevel: string;
  contentType: string;
  isFree: boolean;
  priceUsd: unknown;
  author?: string | null;
}): LandingCatalogItem {
  const priceUzs = catalogPriceUzs(row);
  const isFree = row.isFree || priceUzs === 0;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    author: row.author ?? null,
    coverImageUrl: row.coverImageKey ?? null,
    language: row.language,
    cefr: row.cefrLevel,
    contentType: row.contentType,
    isFree,
    priceUzs: isFree ? 0 : priceUzs,
  };
}

function readerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  const token = parts[0] ?? '';
  return token.slice(0, 2).toUpperCase();
}

function isUsableDisplayName(name: string | null | undefined): name is string {
  const value = name?.trim() ?? '';
  if (value.length < 2) return false;
  if (isFigmaSampleDisplayName(value)) return false;
  if (FIGMA_LANDING_DISPLAY_NAMES.has(value.toLowerCase())) return false;
  return true;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);
  private landingCache: { at: number; payload: LandingPayload } | null = null;

  constructor(private prisma: PrismaService) {}

  async stats() {
    const learnerCount = await this.prisma.user.count({ where: liveLearnerWhere() });
    return {
      learnerCount,
      displayLearnerCount: learnerCount,
    };
  }

  /**
   * Public marketing pricing copy. There is NO recurring subscription in this product —
   * learners get a free allowance and pay Atmos once, per import, only when they exceed it.
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
      priceLabel: '0 soʻm',
      priceUnit: 'to start',
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
        `${importLimit} free imports / day`,
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

  async landing(): Promise<LandingPayload> {
    const now = Date.now();
    if (this.landingCache && now - this.landingCache.at < LANDING_CACHE_TTL_MS) {
      return this.landingCache.payload;
    }

    const [stats, languages, catalog, importPricing, topReaders] = await Promise.all([
      this.safeStats(),
      this.safeLanguages(),
      this.safeCatalog(),
      this.safeImportPricing(),
      this.safeTopReaders(),
    ]);

    const payload: LandingPayload = {
      generatedAt: new Date().toISOString(),
      stats,
      languages,
      catalog,
      importPricing,
      topReaders,
    };
    this.landingCache = { at: now, payload };
    return payload;
  }

  private async safeStats(): Promise<LandingPayload['stats']> {
    try {
      const learnerCount = await this.prisma.user.count({ where: liveLearnerWhere() });
      return { learnerCount };
    } catch (err) {
      this.logger.warn(`landing stats failed: ${err instanceof Error ? err.message : err}`);
      return { learnerCount: 0 };
    }
  }

  private async safeLanguages(): Promise<LandingPayload['languages']> {
    try {
      const rows = await this.prisma.languageCatalog.findMany({
        where: { isEnabled: true },
        orderBy: { sortOrder: 'asc' },
        select: { code: true, name: true, nativeName: true, flagEmoji: true },
      });
      if (rows.length > 0) {
        return rows.map((r) => ({
          code: r.code,
          name: r.name,
          nativeName: r.nativeName,
          flagEmoji: r.flagEmoji,
        }));
      }
    } catch (err) {
      this.logger.warn(`landing languages failed: ${err instanceof Error ? err.message : err}`);
    }
    return LIVE_LANGUAGE_CODES.map((code) => ({
      code,
      name: LANGUAGE_META[code].label,
      nativeName: LANGUAGE_META[code].nativeName,
      flagEmoji: LANGUAGE_META[code].flag,
    }));
  }

  private async safeCatalog(): Promise<LandingPayload['catalog']> {
    try {
      const featuredCollections = await this.prisma.contentCollection.findMany({
        where: { isFeatured: true },
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            orderBy: { sortOrder: 'asc' },
            include: { content: true },
          },
        },
      });

      const featuredItems: LandingCatalogItem[] = [];
      const seen = new Set<string>();
      for (const collection of featuredCollections) {
        for (const join of collection.items) {
          const row = join.content;
          if (seen.has(row.id)) continue;
          if (row.publishStatus !== PublishStatus.published) continue;
          if (row.contentSource === ContentSource.user_import || row.contentType === ContentType.user_import) {
            continue;
          }
          seen.add(row.id);
          featuredItems.push(serializeCatalogItem(row));
          if (featuredItems.length >= CATALOG_CAP) {
            return { source: 'featured', items: featuredItems };
          }
        }
      }

      if (featuredItems.length > 0) {
        return { source: 'featured', items: featuredItems };
      }

      const recent = await this.prisma.contentItem.findMany({
        where: catalogWhere(),
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: CATALOG_CAP,
      });
      return { source: 'recent', items: recent.map(serializeCatalogItem) };
    } catch (err) {
      this.logger.warn(`landing catalog failed: ${err instanceof Error ? err.message : err}`);
      return { source: 'recent', items: [] };
    }
  }

  private async getImportFreeLimits(): Promise<LandingImportPricing['freeLimits']> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } });
    if (!row?.value || typeof row.value !== 'object') return DEFAULT_FREE_LIMITS;
    const merged = { ...DEFAULT_FREE_LIMITS, ...(row.value as object) } as typeof DEFAULT_FREE_LIMITS;
    const cycle = ['daily', 'monthly', 'yearly'].includes(merged.resetCycle)
      ? (merged.resetCycle as LandingImportPricing['freeLimits']['resetCycle'])
      : 'monthly';
    return {
      dailyFreeImportsPerUser: Number(merged.dailyFreeImportsPerUser) || 0,
      monthlyFreePageLimit: Number(merged.monthlyFreePageLimit) || 0,
      allowedFormats: normalizeAllowedFormats(merged.allowedFormats),
      resetCycle: cycle,
    };
  }

  private async safeImportPricing(): Promise<LandingImportPricing> {
    try {
      const [tiers, freeLimits] = await Promise.all([
        this.prisma.importPageTier.findMany({ orderBy: { sortOrder: 'asc' } }),
        this.getImportFreeLimits(),
      ]);
      return {
        currency: 'UZS',
        atmosMinAmountSom: atmosMinAmountSom(),
        freeLimits,
        tiers: tiers.map((tier) => ({
          id: tier.id,
          label: tier.label,
          minPages: tier.minPages,
          maxPages: tier.maxPages,
          priceUzs: Math.round(Number(tier.priceUsd) || 0),
          sortOrder: tier.sortOrder,
        })),
      };
    } catch (err) {
      this.logger.warn(`landing import pricing failed: ${err instanceof Error ? err.message : err}`);
      return emptyPricing();
    }
  }

  private async safeTopReaders(): Promise<LandingTopReader[]> {
    try {
      const users = await this.prisma.user.findMany({
        where: {
          ...liveLearnerWhere(),
          displayName: { not: null },
        },
        select: {
          displayName: true,
          streakCount: true,
          streakLastDate: true,
          createdAt: true,
          readingProgress: { select: { totalReadSeconds: true } },
          _count: { select: { vocabulary: true } },
        },
        take: READER_SCAN_CAP,
      });

      const ranked = users
        .map((user) => {
          const displayName = user.displayName?.trim() ?? '';
          const minutesRead = Math.floor(
            user.readingProgress.reduce((sum, row) => sum + (row.totalReadSeconds || 0), 0) / 60,
          );
          const streakDays = effectiveStreakCount(user.streakCount, user.streakLastDate);
          const wordsLearned = user._count.vocabulary;
          return {
            displayName,
            minutesRead,
            streakDays,
            wordsLearned,
            createdAt: user.createdAt.getTime(),
          };
        })
        .filter((row) => isUsableDisplayName(row.displayName))
        .filter(
          (row) => row.minutesRead >= 30 || (row.streakDays >= 3 && row.wordsLearned >= 10),
        )
        .sort((a, b) => {
          if (b.minutesRead !== a.minutesRead) return b.minutesRead - a.minutesRead;
          if (b.streakDays !== a.streakDays) return b.streakDays - a.streakDays;
          if (b.wordsLearned !== a.wordsLearned) return b.wordsLearned - a.wordsLearned;
          return a.createdAt - b.createdAt;
        })
        .slice(0, READER_CAP);

      return ranked.map((row, index) => ({
        rank: index + 1,
        displayName: row.displayName,
        initials: readerInitials(row.displayName),
        minutesRead: row.minutesRead,
        streakDays: row.streakDays,
        wordsLearned: row.wordsLearned,
      }));
    } catch (err) {
      this.logger.warn(`landing top readers failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }
}
