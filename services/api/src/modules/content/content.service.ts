import { Injectable, NotFoundException } from '@nestjs/common';
import { PublishStatus, Prisma } from '@prisma/client';
import { APP_LANGUAGES } from '@gotcha/shared';
import { isDevAuthEnabled } from '../../common/dev-auth/dev-auth.config';
import {
  getDevContentById,
  getDevFeed,
  getDevSegments,
} from '../../common/dev-auth/dev-content.data';
import { PrismaService } from '../../prisma/prisma.service';
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

@Injectable()
export class ContentService {
  constructor(private prisma: PrismaService) {}

  private useDevContent() {
    return isDevAuthEnabled() && !this.prisma.dbAvailable;
  }

  /** Languages learners may select — respects admin LanguageCatalog.isEnabled. */
  async listLanguages() {
    if (this.useDevContent()) {
      return APP_LANGUAGES.map((code) => ({
        code,
        ...(FALLBACK_LANG_META[code] ?? { name: code, nativeName: code, flagEmoji: '🌐' }),
        isEnabled: true,
      }));
    }

    const rows = await this.prisma.languageCatalog.findMany({
      where: { isEnabled: true },
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

    // Catalog not seeded yet — fall back to shared AppLanguage set.
    return APP_LANGUAGES.map((code) => ({
      code,
      ...(FALLBACK_LANG_META[code] ?? { name: code, nativeName: code, flagEmoji: '🌐' }),
      isEnabled: true,
    }));
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
      // Ensure the learner's own imports surface in Library / Browse (Imports filter).
      this.prisma.contentItem.findMany({
        where: {
          publishStatus: PublishStatus.published,
          createdById: userId,
          contentSource: 'user_import',
          ...(targetLang ? { language: targetLang as never } : {}),
        },
        orderBy: { publishedAt: 'desc' },
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
        ...p.content,
        progressPct: p.progressPct,
        lastReadAt: p.lastReadAt,
      })),
      featuredCollections: featured,
      recentlyPublished: mergedRecent,
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
      items,
      total,
      page,
      pageSize,
      hasMore: skip + items.length < total,
    };
  }

  async getById(id: string) {
    if (this.useDevContent()) {
      const item = getDevContentById(id);
      if (!item) throw new NotFoundException('Content not found');
      return item;
    }

    const item = await this.prisma.contentItem.findFirst({
      where: { id, publishStatus: PublishStatus.published },
      include: {
        license: true,
        segments: {
          select: { id: true, segmentIndex: true, title: true, wordCount: true },
          orderBy: { segmentIndex: 'asc' },
        },
      },
    });
    if (!item) throw new NotFoundException('Content not found');
    return item;
  }

  async getSegments(contentId: string, from = 0, limit = 5) {
    if (this.useDevContent()) {
      const result = getDevSegments(contentId);
      if (!result) throw new NotFoundException('Content not found');
      return {
        contentId,
        segments: result.segments.filter((s) => s.segmentIndex >= from).slice(0, limit),
      };
    }

    const content = await this.prisma.contentItem.findFirst({
      where: { id: contentId, publishStatus: PublishStatus.published },
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

    const data = {
      segmentId: dto.segmentId,
      charOffset: dto.charOffset,
      progressPct: dto.progressPct,
      lastReadAt: new Date(),
      totalReadSeconds: existing
        ? existing.totalReadSeconds + (dto.readSeconds ?? 0)
        : (dto.readSeconds ?? 0),
      completedAt: dto.completed ? new Date() : undefined,
    };

    return this.prisma.readingProgress.upsert({
      where: { userId_contentId: { userId, contentId } },
      create: { userId, contentId, ...data, progressPct: dto.progressPct ?? 0 },
      update: data,
    });
  }
}
