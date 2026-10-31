import { resolveCoverKey, type CoverMode } from '@gotcha/shared';
import { userImportOwnerWhere } from './user-import-privacy';
import { ageBand, AgeBand, allowedAgeRatings } from '../../common/safety/age-policy';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ContentSource, ContentType, PublishStatus, Prisma, PurchaseStatus, WordStatus } from '@prisma/client';
import { APP_LANGUAGES, LANGUAGE_META, LIVE_LANGUAGES } from '@gotcha/shared';
import { ensureLanguageCatalog, getLearnerVisibleLanguageCodes } from '../../common/language-catalog';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import {
  getDevContentById,
  getDevFeed,
  getDevSegments,
} from '../../common/dev-auth/dev-content.data';
import { PrismaService } from '../../prisma/prisma.service';
import { StreakService } from '../../services/streak.service';
import { recordReadingActivity } from '../reading/reading-activity';
import { ContentQueryDto, UpdateProgressDto } from './dto/content.dto';
import {
  catalogAccessGranted,
  catalogPriceUzs,
  catalogTrialSegmentCount,
  paidCatalogIds,
  requiresCatalogPayment,
  type CatalogPricedItem,
} from './catalog-access';
import { interleaveByLanguage } from './feed-order';

const FALLBACK_LANG_META: Record<string, { name: string; nativeName: string; flagEmoji: string }> = Object.fromEntries(
  Object.entries(LANGUAGE_META).map(([code, meta]) => [
    code,
    { name: meta.label, nativeName: meta.nativeName, flagEmoji: meta.flag },
  ]),
);

/** Map Prisma content fields → learner app DTO (cover + author + catalog commerce). */
function serializeContent(item: object, access?: { granted: boolean }) {
  const row = item as CatalogPricedItem & {
    coverImageKey?: string | null;
    coverMode?: string | null;
    originalCoverKey?: string | null;
    subtitle?: string | null;
    author?: string | null;
    isFree?: boolean;
  };
  const priced: CatalogPricedItem = {
    id: row.id,
    isFree: row.isFree ?? true,
    priceUsd: row.priceUsd,
    contentSource: row.contentSource,
    contentType: row.contentType,
    createdById: row.createdById,
  };
  const locked = requiresCatalogPayment(priced);
  const priceUzs = catalogPriceUzs(priced);
  const { originalCoverKey: _orig, ...rest } = row;
  return {
    ...rest,
    // covers-01: template mode ⇒ null (the learner draws the cover); upload/original ⇒ that image.
    coverImageUrl: resolveCoverKey(row),
    coverMode: (row.coverMode as CoverMode | undefined) ?? 'template',
    authorName: row.author ?? row.subtitle ?? null,
    isFree: !locked,
    priceUzs,
    accessGranted: access?.granted ?? !locked,
  };
}

@Injectable()
export class ContentService {
  constructor(
    private prisma: PrismaService,
    private streak: StreakService,
  ) {}

  private useDevContent() {
    return isDevAuthEnabled() && !this.prisma.dbAvailable;
  }

  private async learnerVisibleLanguages(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nativeLanguage: true },
    });
    const allowed = await getLearnerVisibleLanguageCodes(this.prisma, user?.nativeLanguage);
    return { nativeLanguage: user?.nativeLanguage ?? null, allowed };
  }

  private catalogLanguageWhere(
    allowed: string[],
    targetLang?: string,
  ): Prisma.ContentItemWhereInput {
    if (targetLang) {
      if (!allowed.includes(targetLang)) {
        return { language: { in: [] as never[] } };
      }
      return { language: targetLang as never };
    }
    return { language: { in: allowed as never[] } };
  }

  private async decorateLearnerItems(
    items: object[],
    userId?: string,
    isAdmin?: boolean,
  ) {
    const priced = items as CatalogPricedItem[];
    const purchasedIds = await paidCatalogIds(
      this.prisma,
      userId,
      priced.map((item) => item.id),
    );
    return priced.map((item) =>
      serializeContent(item, {
        granted: catalogAccessGranted({ item, userId, isAdmin, purchasedIds }),
      }),
    );
  }

  private async assertLearnerCanRead(contentId: string, userId?: string, isAdmin?: boolean) {
    const item = await this.prisma.contentItem.findFirst({
      where: { AND: [this.readableByLearnerWhere(contentId, userId), userImportOwnerWhere(userId, isAdmin), await this.learnerAgeWhere(userId, isAdmin)] },
    });
    if (!item) throw new NotFoundException('Content not found');
    const purchasedIds = await paidCatalogIds(this.prisma, userId, [item.id]);
    if (!catalogAccessGranted({ item, userId, isAdmin, purchasedIds })) {
      throw new ForbiddenException('Payment required to read this book');
    }
    return item;
  }

  /**
   * Learner content APIs are published-only for the catalog, but the importer must be
   * able to read their own `review` imports immediately (moderation only gates public
   * visibility — not the owner's reader). Archived/rejected stays hidden.
   */
  /**
   * W-12 / AI-1: minors only see catalog books rated for their band (under-13 → all_ages,
   * 13-17 / unknown age → all_ages + teen_13). A learner's own imports stay readable to
   * them; imported text is checked separately (see WEB-LAUNCH-PLAN content-import).
   */
  private async learnerAgeWhere(userId?: string, isAdmin?: boolean): Promise<Prisma.ContentItemWhereInput> {
    if (isAdmin) return {};
    let band: AgeBand;
    if (!userId) band = 'adult'; // anonymous catalog browsing: can't read without an account
    else {
      const u = await this.prisma.user.findUnique({ where: { id: userId }, select: { birthYear: true } });
      band = ageBand(u?.birthYear ?? null);
    }
    const ratings = allowedAgeRatings(band);
    if (!ratings) return {};
    return { OR: [{ ageRating: { in: ratings } }, ...(userId ? [{ createdById: userId }] : [])] };
  }

  private readableByLearnerWhere(id: string, userId?: string): Prisma.ContentItemWhereInput {
    if (!userId) {
      return { id, publishStatus: PublishStatus.published };
    }
    return {
      id,
      OR: [
        { publishStatus: PublishStatus.published },
        {
          createdById: userId,
          publishStatus: { in: [PublishStatus.published, PublishStatus.review, PublishStatus.draft] },
        },
        { readingProgress: { some: { userId } } },
        // final-5: a completed purchase keeps an archived catalog book readable for its buyer.
        { purchases: { some: { userId, status: PurchaseStatus.completed } } },
      ],
    };
  }

  /** Languages learners may select — whatever admin has enabled in LanguageCatalog. */
  async listLanguages() {
    const toRow = (code: string) => {
      const meta = LANGUAGE_META[code as keyof typeof LANGUAGE_META];
      return {
        code,
        name: meta?.label ?? FALLBACK_LANG_META[code]?.name ?? code,
        nativeName: meta?.nativeName ?? FALLBACK_LANG_META[code]?.nativeName ?? code,
        flagEmoji: meta?.flag ?? FALLBACK_LANG_META[code]?.flagEmoji ?? '🌐',
        isEnabled: true,
      };
    };

    if (this.useDevContent()) {
      return LIVE_LANGUAGES.map(toRow);
    }

    await ensureLanguageCatalog(this.prisma);
    const rows = await this.prisma.languageCatalog.findMany({
      where: { isEnabled: true, code: { in: [...APP_LANGUAGES] } },
      orderBy: { sortOrder: 'asc' },
    });

    if (rows.length > 0) {
      return rows.map((r) => ({
        code: r.code,
        name: r.name,
        nativeName: r.nativeName,
        flagEmoji: r.flagEmoji,
        isEnabled: r.isEnabled,
      }));
    }

    return LIVE_LANGUAGES.map(toRow);
  }

  async getFeed(userId: string, targetLang?: string) {
    const { allowed } = await this.learnerVisibleLanguages(userId);
    const langWhere = this.catalogLanguageWhere(allowed, targetLang);
    const isVisible = (language: string) =>
      targetLang ? language === targetLang && allowed.includes(targetLang) : allowed.includes(language);

    if (this.useDevContent()) {
      const feed = getDevFeed();
      const filterItem = (item: { language: string }) => isVisible(item.language);
      return {
        ...feed,
        continueReading: feed.continueReading?.filter(filterItem) ?? [],
        featuredCollections: feed.featuredCollections.map((c) => ({
          ...c,
          items: c.items.filter((i) => filterItem(i.content)),
        })),
        recentlyPublished: feed.recentlyPublished.filter(filterItem),
        myImports: [],
      };
    }

    const progress = await this.prisma.readingProgress.findMany({
      where: { userId, completedAt: null },
      include: {
        content: {
          include: { license: true },
        },
      },
      orderBy: { lastReadAt: 'desc' },
      take: 10,
    });

    const catalogWhere: Prisma.ContentItemWhereInput = {
      publishStatus: PublishStatus.published,
      AND: [await this.learnerAgeWhere(userId)],
      contentSource: { not: ContentSource.user_import },
      contentType: { not: ContentType.user_import },
      ...langWhere,
    };

    const [featured, recent, myImports] = await Promise.all([
      this.prisma.contentCollection.findMany({
        where: {
          isFeatured: true,
          ...(targetLang && allowed.includes(targetLang) ? { language: targetLang as never } : {}),
        },
        include: {
          items: {
            include: { content: true },
            orderBy: { sortOrder: 'asc' },
            take: 12,
          },
        },
        orderBy: { sortOrder: 'asc' },
      }),
      this.prisma.contentItem.findMany({
        where: catalogWhere,
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 96,
      }),
      this.prisma.contentItem.findMany({
        where: {
          publishStatus: { in: [PublishStatus.published, PublishStatus.review] },
          createdById: userId,
          contentSource: ContentSource.user_import,
          ...langWhere,
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 24,
      }),
    ]);

    const visibleProgress = progress.filter((p) => isVisible(p.content.language));

    const featuredContents = featured.flatMap((c) =>
      c.items
        .filter(
          (i) =>
            isVisible(i.content.language) &&
            i.content.contentSource !== ContentSource.user_import &&
            i.content.contentType !== ContentType.user_import,
        )
        .map((i) => i.content),
    );
    const recentInterleaved = interleaveByLanguage(recent, 48);
    const [continueRows, featuredRows, recentRows, importRows] = await Promise.all([
      this.decorateLearnerItems(visibleProgress.map((p) => p.content), userId),
      this.decorateLearnerItems(featuredContents, userId),
      this.decorateLearnerItems(recentInterleaved, userId),
      this.decorateLearnerItems(myImports, userId),
    ]);
    const featuredById = new Map(featuredRows.map((row) => [row.id, row]));

    const catalogFeatured = featured.map((c) => ({
      ...c,
      items: c.items
        .filter(
          (i) =>
            isVisible(i.content.language) &&
            i.content.contentSource !== ContentSource.user_import &&
            i.content.contentType !== ContentType.user_import,
        )
        .map((i) => ({
          ...i,
          content: featuredById.get(i.content.id) ?? serializeContent(i.content),
        })),
    }));

    return {
      continueReading: continueRows.map((row, index) => ({
        ...row,
        progressPct: visibleProgress[index]?.progressPct,
        lastReadAt: visibleProgress[index]?.lastReadAt,
        knownWordRatio: visibleProgress[index]?.knownWordRatio ?? null,
      })),
      featuredCollections: catalogFeatured,
      recentlyPublished: recentRows,
      myImports: importRows,
    };
  }

  async list(query: ContentQueryDto, userId?: string, isAdmin?: boolean) {
    const learnerScope = userId ? await this.learnerVisibleLanguages(userId) : null;

    if (this.useDevContent()) {
      let items = getDevFeed().recentlyPublished;
      if (learnerScope) {
        items = items.filter((i) => learnerScope.allowed.includes(i.language));
      }
      if (query.lang) {
        if (learnerScope && !learnerScope.allowed.includes(query.lang)) {
          items = [];
        } else {
          items = items.filter((i) => i.language === query.lang);
        }
      }
      if (query.level) items = items.filter((i) => i.cefrLevel === query.level);
      if (query.q) {
        const q = query.q.toLowerCase();
        items = items.filter(
          (i) =>
            i.title.toLowerCase().includes(q) ||
            (i.description?.toLowerCase().includes(q) ?? false),
        );
      }
      return { items, total: items.length, page: 1, pageSize: items.length, hasMore: false };
    }

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const skip = (page - 1) * pageSize;

    if (learnerScope && query.lang && !learnerScope.allowed.includes(query.lang)) {
      return { items: [], total: 0, page, pageSize, hasMore: false };
    }

    const where: Prisma.ContentItemWhereInput = {
      publishStatus: PublishStatus.published,
      AND: [await this.learnerAgeWhere(userId, isAdmin)],
      ...(query.lang
        ? { language: query.lang }
        : learnerScope
          ? { language: { in: learnerScope.allowed as never[] } }
          : {}),
      ...(query.level ? { cefrLevel: query.level } : {}),
      ...(query.genre ? { genre: query.genre } : {}),
      ...(query.type ? { contentType: query.type } : {}),
      ...(query.source
        ? { contentSource: query.source }
        : {
            contentSource: { not: ContentSource.user_import },
            contentType: { not: ContentType.user_import },
          }),
      ...(query.q
        ? {
            OR: [
              { title: { contains: query.q, mode: 'insensitive' } },
              { description: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.contentItem.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { publishedAt: 'desc' },
        include: { license: { select: { attributionText: true, status: true } } },
      }),
      this.prisma.contentItem.count({ where }),
    ]);

    return {
      items: await this.decorateLearnerItems(items, userId, isAdmin),
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async getById(id: string, userId?: string, isAdmin?: boolean) {
    if (this.useDevContent()) {
      const item = getDevContentById(id);
      if (!item) throw new NotFoundException('Content not found');
      const segments = item.segments ?? [];
      return {
        ...serializeContent(item),
        segmentCount: segments.length,
        progressPct: item.progressPct ?? 0,
      };
    }

    const item = await this.prisma.contentItem.findFirst({
      where: { AND: [this.readableByLearnerWhere(id, userId), userImportOwnerWhere(userId, isAdmin), await this.learnerAgeWhere(userId, isAdmin)] },
      include: {
        license: true,
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

    const progress = userId
      ? await this.prisma.readingProgress.findUnique({
          where: { userId_contentId: { userId, contentId: id } },
        })
      : null;

    const { segments, ...rest } = item;
    const [decorated] = await this.decorateLearnerItems([rest], userId, isAdmin);
    const granted = decorated.accessGranted !== false;
    const trialSegmentCount =
      granted || !requiresCatalogPayment(item) ? 0 : catalogTrialSegmentCount(segments);
    return {
      ...decorated,
      segmentCount: segments.length,
      outline: segments,
      trialSegmentCount,
      progressPct: progress?.progressPct ?? 0,
      lastReadAt: progress?.lastReadAt ?? null,
      currentSegmentId: progress?.segmentId ?? null,
    };
  }

  async getSegments(contentId: string, from = 0, limit = 5, userId?: string, isAdmin?: boolean) {
    if (this.useDevContent()) {
      const result = getDevSegments(contentId);
      if (!result) throw new NotFoundException('Content not found');
      return {
        contentId,
        segments: result.segments.filter((s) => s.segmentIndex >= from).slice(0, limit),
      };
    }

    const item = await this.prisma.contentItem.findFirst({
      where: { AND: [this.readableByLearnerWhere(contentId, userId), userImportOwnerWhere(userId, isAdmin), await this.learnerAgeWhere(userId, isAdmin)] },
      select: {
        id: true,
        isFree: true,
        priceUsd: true,
        contentSource: true,
        contentType: true,
        createdById: true,
      },
    });
    if (!item) throw new NotFoundException('Content not found');

    const purchasedIds = await paidCatalogIds(this.prisma, userId, [item.id]);
    const granted = catalogAccessGranted({ item, userId, isAdmin, purchasedIds });

    const take = Math.min(Math.max(Number.isFinite(limit) ? limit : 1, 1), 200);
    let maxIndex: number | undefined;
    if (!granted) {
      const outline = await this.prisma.contentSegment.findMany({
        where: { contentId },
        select: { segmentIndex: true, chapterIndex: true },
        orderBy: { segmentIndex: 'asc' },
      });
      const trialCount = catalogTrialSegmentCount(outline);
      const trialLast = trialCount > 0 ? outline[trialCount - 1]?.segmentIndex : undefined;
      if (trialLast == null || from > trialLast) {
        throw new ForbiddenException('Payment required to continue reading this book');
      }
      maxIndex = trialLast;
    }

    const segments = await this.prisma.contentSegment.findMany({
      where: {
        contentId,
        segmentIndex: {
          gte: from,
          ...(maxIndex != null ? { lte: maxIndex } : {}),
        },
      },
      orderBy: { segmentIndex: 'asc' },
      take,
    });

    return { contentId, segments, trial: !granted };
  }

  async updateProgress(userId: string, contentId: string, dto: UpdateProgressDto, isAdmin?: boolean) {
    if (this.useDevContent()) {
      return {
        userId,
        contentId,
        segmentId: dto.segmentId,
        charOffset: dto.charOffset ?? 0,
        progressPct: dto.progressPct ?? 0,
        lastReadAt: new Date(),
        totalReadSeconds: dto.readSeconds ?? 0,
        completedAt: dto.completed ? new Date() : null,
      };
    }

    await this.assertLearnerCanRead(contentId, userId, isAdmin);

    const existing = await this.prisma.readingProgress.findUnique({
      where: { userId_contentId: { userId, contentId } },
    });

    // Kept in parity with reading.service.ts's PUT /reading/progress/:contentId so both
    // "update progress" endpoints drive the same streak/known-word-ratio side effects
    // (previously only the reading module's endpoint did this — see docs/E2E_AUDIT_REPORT.md).
    const knownCount = await this.prisma.userKnownWord.count({
      where: { userId, status: { in: [WordStatus.known, WordStatus.learning] } },
    });
    const content = await this.prisma.contentItem.findUnique({ where: { id: contentId } });
    const knownWordRatio = content?.uniqueWordCount
      ? Math.min(1, knownCount / content.uniqueWordCount)
      : undefined;

    const data = {
      segmentId: dto.segmentId,
      charOffset: dto.charOffset,
      progressPct: dto.progressPct,
      knownWordRatio,
      lastReadAt: new Date(),
      totalReadSeconds: existing
        ? existing.totalReadSeconds + (dto.readSeconds ?? 0)
        : (dto.readSeconds ?? 0),
      completedAt: dto.completed ? new Date() : undefined,
    };

    if (dto.readSeconds && dto.readSeconds > 0) {
      await this.streak.recordActivity(userId, dto.readSeconds ?? 0);
      await recordReadingActivity(
        this.prisma,
        userId,
        contentId,
        dto.segmentId,
        dto.readSeconds,
      );
    }

    return this.prisma.readingProgress.upsert({
      where: { userId_contentId: { userId, contentId } },
      create: { userId, contentId, ...data, progressPct: dto.progressPct ?? 0 },
      update: data,
    });
  }
}
