import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ContentSource,
  ContentType,
  LicenseStatus,
  ModerationStatus,
  PublishStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { tokenizeText, slugify, uniqueWordCount } from '../../utils/tokenizer';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const [users, content, imports, moderationPending, ingestionQueued, aiToday] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.contentItem.count({ where: { publishStatus: PublishStatus.published } }),
        this.prisma.userImport.count(),
        this.prisma.moderationQueue.count({ where: { status: 'pending' } }),
        this.prisma.ingestionJob.count({ where: { status: 'queued' } }),
        this.prisma.aiUsageDaily.aggregate({ _sum: { tokensUsed: true, lookupCount: true } }),
      ]);

    return {
      users,
      publishedContent: content,
      userImports: imports,
      moderationPending,
      ingestionQueued,
      aiUsageTotal: aiToday._sum,
    };
  }

  listContent(status?: PublishStatus) {
    return this.prisma.contentItem.findMany({
      where: status ? { publishStatus: status } : undefined,
      orderBy: { updatedAt: 'desc' },
      include: { license: true },
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
}
