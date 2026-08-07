import { Injectable, NotFoundException } from '@nestjs/common';
import { ContentSource, ContentType, ImportType, PublishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from '../../services/limits.service';
import { tokenizeText, slugify, paginateText } from '../../utils/tokenizer';
import { ImportPasteDto, ImportUrlDto } from './dto/imports.dto';

@Injectable()
export class ImportsService {
  constructor(
    private prisma: PrismaService,
    private limits: LimitsService,
  ) {}

  async list(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

    const [items, total] = await Promise.all([
      this.prisma.userImport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { content: { select: { id: true, title: true, slug: true, wordCount: true } } },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.userImport.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: safePage * safePageSize < total,
    };
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userImport.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Import not found');
    await this.prisma.userImport.delete({ where: { id } });
    return { id, deleted: true };
  }

  async importPaste(userId: string, dto: ImportPasteDto) {
    await this.limits.assertImportAllowed(userId);

    const userImport = await this.prisma.userImport.create({
      data: {
        userId,
        title: dto.title,
        importType: ImportType.paste,
        language: dto.language,
        ingestionStatus: 'processing',
      },
    });

    try {
      const content = await this.createImportContent(userId, dto.title, dto.text, dto.language);
      return this.prisma.userImport.update({
        where: { id: userImport.id },
        data: {
          ingestionStatus: 'ready',
          contentId: content.id,
        },
        include: { content: true },
      });
    } catch (err) {
      return this.prisma.userImport.update({
        where: { id: userImport.id },
        data: {
          ingestionStatus: 'failed',
          errorMessage: err instanceof Error ? err.message : 'Import failed',
        },
      });
    }
  }

  async importUrl(userId: string, dto: ImportUrlDto) {
    await this.limits.assertImportAllowed(userId);

    const userImport = await this.prisma.userImport.create({
      data: {
        userId,
        title: dto.title,
        importType: ImportType.url,
        sourceUrl: dto.url,
        language: dto.language,
        ingestionStatus: 'queued',
      },
    });

    await this.prisma.ingestionJob.create({
      data: {
        sourceType: 'url',
        payload: { importId: userImport.id, url: dto.url, title: dto.title, userId },
        createdById: userId,
      },
    });

    return userImport;
  }

  private async createImportContent(
    userId: string,
    title: string,
    text: string,
    language?: string | null,
  ) {
    const chunks = paginateText(text);
    if (chunks.length === 0) {
      throw new Error('Import text is empty');
    }

    const segmentCreates = chunks.map((chunk, index) => {
      const { tokenMap, sentenceMap, wordCount } = tokenizeText(chunk.plainText);
      return {
        segmentIndex: index,
        title: chunk.title,
        plainText: chunk.plainText,
        tokenMap: tokenMap as never,
        sentenceMap: sentenceMap as never,
        wordCount,
      };
    });

    const totalWordCount = segmentCreates.reduce((sum, s) => sum + s.wordCount, 0);
    const allLemmas = new Set<string>();
    for (const seg of segmentCreates) {
      for (const t of seg.tokenMap as { isWord?: boolean; lemma?: string | null }[]) {
        if (t.isWord && t.lemma) allLemmas.add(t.lemma);
      }
    }

    const slugBase = slugify(title) || 'import';
    const slug = `${slugBase}-${Date.now()}`;

    const content = await this.prisma.contentItem.create({
      data: {
        slug,
        title,
        language: (language as never) ?? 'en',
        contentType: ContentType.user_import,
        contentSource: ContentSource.user_import,
        cefrLevel: 'b1',
        wordCount: totalWordCount,
        uniqueWordCount: allLemmas.size,
        publishStatus: PublishStatus.published,
        publishedAt: new Date(),
        createdById: userId,
        segments: {
          create: segmentCreates,
        },
      },
      include: { segments: true },
    });

    return content;
  }
}
