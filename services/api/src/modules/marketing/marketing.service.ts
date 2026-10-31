import { DAILY_CAP_FALLBACKS } from '@gotcha/shared';
import { formatSom, planCopy, type PlanLang } from './plan-copy';
import { Injectable, Logger } from '@nestjs/common';
import { ContentSource, ContentType, PublishStatus } from '@prisma/client';
import { LANGUAGE_META } from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { liveLearnerWhere } from '../../common/production-users';
import { atmosMinAmountSom } from '../billing/atmos.client';
import { catalogPriceUzs } from '../content/catalog-access';
import { normalizeAllowedFormats } from '../../common/import-format';
import { getPlanCaps } from '../../common/plan-caps';

const LIVE_LANGUAGE_CODES = ['en', 'ru', 'uz'] as const;
const LANDING_CACHE_TTL_MS = 60_000;
const CATALOG_CAP = 12;

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

/**
 * Hotfix web1 (AUDIT C4/C6): the public landing payload carries no learner names, no per-user
 * stats and no learner counter. `stats` / `topReaders` stay in the shape (always zero / empty)
 * so cached or older web builds keep working.
 */
export function publicLandingPayload(
  p: Omit<LandingPayload, 'stats' | 'topReaders'>,
): LandingPayload {
  return { ...p, stats: { learnerCount: 0 }, topReaders: [] };
}

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

/** W-03: public learner counts are hidden (0) until there are at least this many learners. */
export const PUBLIC_LEARNER_MIN = 100;
export function publicLearnerCount(n: number, min = PUBLIC_LEARNER_MIN): number {
  return n >= min ? n : 0;
}

@Injectable()
export class MarketingService {
  private readonly logger = new Logger(MarketingService.name);
  private landingCache: { at: number; payload: LandingPayload } | null = null;

  constructor(private prisma: PrismaService) {}

  async stats() {
    const learnerCount = await this.prisma.user.count({ where: liveLearnerWhere() });
    const shown = publicLearnerCount(learnerCount);
    return {
      learnerCount: shown,
      displayLearnerCount: shown,
    };
  }

  /**
   * Public marketing pricing copy. There is NO recurring subscription in this product —
   * learners get a free allowance and pay Atmos once, per import, only when they exceed it.
   */
  async plans(lang: PlanLang = 'en') {
    const t = planCopy(lang);
    const freePlan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: 'free' } });

    // WLF-12: the enforced caps (platform_settings), never the plan row's ai_daily_quota / quiz_daily_quota.
    const caps = await getPlanCaps(this.prisma);
    const aiDailyQuota = caps.free.lookups;
    // WLF-04: the Free card states the real import allowance (admin Import & Pricing → platform setting
    // importFreeLimits, defaults 3 a day / 50 pages a month), the same numbers import-commerce enforces.
    const importFree = await this.getImportFreeLimits().catch(() => DEFAULT_FREE_LIMITS);
    const importLimit = Math.max(0, Math.floor(Number(importFree.dailyFreeImportsPerUser) || 0));
    const pageLimit = Math.max(0, Math.floor(Number(importFree.monthlyFreePageLimit) || 0));

    const free = {
      id: freePlan?.id ?? 'free',
      tier: 'free' as const,
      name: t.freeName,
      priceMonthly: 0,
      priceLabel: formatSom(0, lang),
      priceUnit: t.freeUnit,
      aiDailyQuota,
      importLimit,
      offlineEnabled: false,
      unlimitedLookups: false, // Free has a daily lookup cap (20 by default)
      unlimitedImports: false,
      popular: false,
      cta: t.freeCta,
      features: [
        t.library,
        t.lookupsDay(aiDailyQuota),
        t.quizzesDay(caps.free.quizzes),
        t.importsDay(importLimit),
        t.importPages(pageLimit, importFree.resetCycle),
        t.review,
      ],
    };

    const payPerImport = {
      id: 'pay-per-import',
      tier: 'pay-per-import' as const,
      name: t.ppiName,
      priceMonthly: 0,
      priceLabel: t.ppiLabel,
      priceUnit: t.ppiUnit,
      aiDailyQuota,
      importLimit,
      offlineEnabled: false,
      unlimitedLookups: false,
      unlimitedImports: false,
      popular: true,
      cta: t.ppiCta,
      features: [t.everythingFree, t.payOnce, t.upfront],
    };

    // B4: the pay-per-import card stays hidden until payments-02 is live (PAYMENTS_UI_ENABLED, default off).
    return paymentsUiEnabled() ? [free, payPerImport] : [free];
  }

  async landing(): Promise<LandingPayload> {
    const now = Date.now();
    if (this.landingCache && now - this.landingCache.at < LANDING_CACHE_TTL_MS) {
      return this.landingCache.payload;
    }

    const [languages, catalog, importPricing] = await Promise.all([
      this.safeLanguages(),
      this.safeCatalog(),
      this.safeImportPricing(),
    ]);

    const payload = publicLandingPayload({
      generatedAt: new Date().toISOString(),
      languages,
      catalog,
      importPricing,
    });
    this.landingCache = { at: now, payload };
    return payload;
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
}
