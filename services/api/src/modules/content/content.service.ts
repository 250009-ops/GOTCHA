import { Injectable, NotFoundException } from '@nestjs/common';
import { PublishStatus, Prisma, WordStatus } from '@prisma/client';
import { LIVE_LANGUAGES } from '@gotcha/shared';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import {
  getDevContentById,
  getDevFeed,
  getDevSegments,
} from '../../common/dev-auth/dev-content.data';
import { PrismaService } from '../../prisma/prisma.service';
import { StreakService } from '../../services/streak.service';
import { ContentQueryDto, UpdateProgressDto } from './dto/content.dto';

const FALLBACK_LANG_META: Record<string, { name: string; nativeName: string; flagEmoji: string }> = {
  en: { name: 'English', nativeName: 'English', flagEmoji: '🇬🇧' },
  ru: { name: 'Russian', nativeName: 'Русский', flagEmoji: '🇷🇺' },
  uz: { name: 'Uzbek', nativeName: "Oʻzbekcha", flagEmoji: '🇺🇿' },
  fr: { name: 'French', nativeName: 'Français', flagEmoji: '🇫🇷' },
  es: { name: 'Spanish', nativeName: 'Español', flagEmoji: '🇪🇸' },
  ja: { name: 'Japanese', nativeName: '日本語', flagEmoji: '🇯🇵' },
  de: { name: 'German', nativeName: 'Deutsch', flagEmoji: '🇩🇪' },
  ko: { name: 'Korean', nativeName: '한국어', flagEmoji: '🇰🇷' },
  pt: { name: 'Portuguese', nativeName: 'Português', flagEmoji: '🇵🇹' },
};

/** Map Prisma content fields → learner app DTO (cover + author). */
function serializeContent(item: object) {
  const row = item as {
    coverImageKey?: string | null;
    subtitle?: string | null;
    author?: string | null;
  };
  return {
    ...row,
    coverImageUrl: row.coverImageKey ?? null,
    authorName: row.author ?? row.subtitle ?? null,
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

  /**
   * Learner content APIs are published-only for the catalog, but the importer must be
   * able to read their own `review` imports immediately (moderation only gates public
   * visibility — not the owner's reader). Archived/rejected stays hidden.
   */
  private readableByLearnerWhere(id: string, userId?: string): Prisma.ContentItemWhereInput {
    if (!userId) {
      return { id, publishStatus: PublishStatus.published };
    }
    return {
      id,
      OR: [
        { publishStatus: PublishStatus.published },
        {
          publishStatus: PublishStatus.review,
          createdById: userId,
          contentSource: 'user_import',
        },
      ],
    };
  }

  /** Languages learners may select — live EN/RU/UZ only (catalog extras stay admin-only). */
  async listLanguages() {
    const live = new Set<string>(LIVE_LANGUAGES);
    const toRow = (code: string) => ({
      code,
      ...(FALLBACK_LANG_META[code] ?? { name: code, nativeName: code, flagEmoji: '🌐' }),
      isEnabled: true,
    });

    if (this.useDevContent()) {
      return LIVE_LANGUAGES.map(toRow);
    }

    const rows = await this.prisma.languageCatalog.findMany({
      where: { isEnabled: true, code: { in: [...LIVE_LANGUAGES] } },
      orderBy: { sortOrder: 'asc' },
    });

    if (rows.length > 0) {
      return rows
        .filter((r) => live.has(r.code))
        .map((r) => ({
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
    if (this.useDevContent()) {
      const feed = getDevFeed();
      if (targetLang) {
        return {
          ...feed,
          featuredCollections: feed.featuredCollections.map((c) => ({
            ...c,
            items: c.items.filter((i) => i.content.language === targetLang),
          })),
          recentlyPublished: feed.recentlyPublished.filter((i) => i.language === targetLang),
        };
      }
      return feed;
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

    const where: Prisma.ContentItemWhereInput = {
      publishStatus: PublishStatus.published,
      ...(targetLang ? { language: targetLang as never } : {}),
    };

    const [featured, recent, myImports] = await Promise.all([
      this.prisma.contentCollection.findMany({
        where: { isFeatured: true, ...(targetLang ? { language: targetLang as never } : {}) },
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
        where,
        orderBy: { publishedAt: 'desc' },
        take: 12,
      }),
      // Ensure the learner's own imports surface in Library / Browse (Imports filter),
      // including those still awaiting moderation (`review`).
      this.prisma.contentItem.findMany({
        where: {
          publishStatus: { in: [PublishStatus.published, PublishStatus.review] },
          createdById: userId,
          contentSource: 'user_import',
          ...(targetLang ? { language: targetLang as never } : {}),
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 24,
      }),
    ]);

    const recentIds = new Set(recent.map((r) => r.id));
    const mergedRecent = [
      ...myImports.filter((i) => !recentIds.has(i.id)),
      ...recent,
    ].slice(0, 36);

    return {
      continueReading: progress.map((p) => ({
        ...serializeContent(p.content),
        progressPct: p.progressPct,
        lastReadAt: p.lastReadAt,
        // Include the knownWordRatio so LibraryPage can show a "% known" badge
        // for items in progress. See docs/E2E_AUDIT_REPORT.md item #7 for context.
        knownWordRatio: p.knownWordRatio ?? null,
      })),
      featuredCollections: featured.map((c) => ({
        ...c,
        items: c.items.map((i) => ({
          ...i,
          content: serializeContent(i.content),
        })),
      })),
      recentlyPublished: mergedRecent.map((item) => serializeContent(item)),
    };
  }

  async list(query: ContentQueryDto) {
    if (this.useDevContent()) {
      let items = getDevFeed().recentlyPublished;
      if (query.lang) items = items.filter((i) => i.language === query.lang);
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

    const where: Prisma.ContentItemWhereInput = {
      publishStatus: PublishStatus.published,
      ...(query.lang ? { language: query.lang } : {}),
      ...(query.level ? { cefrLevel: query.level } : {}),
      ...(query.genre ? { genre: query.genre } : {}),
      ...(query.type ? { contentType: query.type } : {}),
      ...(query.source ? { contentSource: query.source } : {}),
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
      items: items.map((item) => serializeContent(item)),
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async getById(id: string, userId?: string) {
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
      where: this.readableByLearnerWhere(id, userId),
      include: {
        license: true,
        segments: {
          select: { id: true, segmentIndex: true, title: true, wordCount: true },
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

    return {
      ...serializeContent(item),
      segmentCount: item.segments.length,
      progressPct: progress?.progressPct ?? 0,
      lastReadAt: progress?.lastReadAt ?? null,
      // Resume-to-last-position: return the segment ID where the user left off.
      // ReaderPage.tsx uses this to open the book at the correct chapter.
      // See docs/E2E_AUDIT_REPORT.md item #6a for context.
      currentSegmentId: progress?.segmentId ?? null,
    };
  }

  async getSegments(contentId: string, from = 0, limit = 5, userId?: string) {
    if (this.useDevContent()) {
      const result = getDevSegments(contentId);
      if (!result) throw new NotFoundException('Content not found');
      return {
        contentId,
        segments: result.segments.filter((s) => s.segmentIndex >= from).slice(0, limit),
      };
    }

    const content = await this.prisma.contentItem.findFirst({
      where: this.readableByLearnerWhere(contentId, userId),
    });
    if (!content) throw new NotFoundException('Content not found');

    const segments = await this.prisma.contentSegment.findMany({
      where: { contentId, segmentIndex: { gte: from } },
      orderBy: { segmentIndex: 'asc' },
      take: limit,
    });

    return { contentId, segments };
  }

  async updateProgress(userId: string, contentId: string, dto: UpdateProgressDto) {
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
      await this.streak.recordActivity(userId, Math.round(dto.readSeconds / 60));
    }

    return this.prisma.readingProgress.upsert({
      where: { userId_contentId: { userId, contentId } },
      create: { userId, contentId, ...data, progressPct: dto.progressPct ?? 0 },
      update: data,
    });
  }
}
