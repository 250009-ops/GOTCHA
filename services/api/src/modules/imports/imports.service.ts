import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ContentSource, ContentType, ImportType, PublishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { LimitsService } from '../../services/limits.service';
import { tokenizeText, slugify, paginateText } from '../../utils/tokenizer';
import { ImportFileDto, ImportPasteDto, ImportUrlDto } from './dto/imports.dto';
import {
  assertMaxChars,
  assertMinWords,
  ExtractedChapter,
  extractTextFromEpub,
  extractTextFromPdf,
  extractTextFromUrl,
  formatFileSizeLimit,
  MAX_FILE_BYTES,
  MIN_IMPORT_WORDS,
  splitTextIntoChapters,
  titleFromUrl,
} from './extract-text';
import { preparePastedText } from './import-text-cleaner';

/** Above this size, finish processing in the background so the client can poll status. */
const ASYNC_PASTE_CHARS = 40_000;
const ASYNC_FILE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private prisma: PrismaService,
    private limits: LimitsService,
  ) {}

  private uploadsRoot() {
    return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  }

  async list(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

    const [items, total, quota] = await Promise.all([
      this.prisma.userImport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { content: { select: { id: true, title: true, slug: true, wordCount: true } } },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.userImport.count({ where: { userId } }),
      this.limits.getImportQuota(userId),
    ]);

    return {
      items,
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: safePage * safePageSize < total,
      importLimit: quota.limit,
      importRemaining: quota.remaining,
      importsUnlimited: quota.unlimited,
    };
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userImport.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Import not found');

    const contentId = existing.contentId;
    const fileKey = existing.fileKey;

    await this.prisma.$transaction(async (tx) => {
      await tx.userImport.delete({ where: { id } });
      if (contentId) {
        await tx.ingestionJob.updateMany({
          where: { contentId },
          data: { contentId: null },
        });
        await tx.contentItem.delete({ where: { id: contentId } }).catch(() => undefined);
      }
    });

    if (fileKey) {
      const absPath = join(this.uploadsRoot(), fileKey);
      await unlink(absPath).catch(() => undefined);
    }

    return { id, deleted: true };
  }

  async importPaste(userId: string, dto: ImportPasteDto) {
    await this.limits.assertImportAllowed(userId);

    try {
      assertMaxChars(dto.text, 'Pasted text');
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid text');
    }

    const text = preparePastedText(dto.text);
    try {
      assertMaxChars(text, 'Pasted text');
      assertMinWords(text);
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Invalid text');
    }

    const title = dto.title.trim();
    const userImport = await this.prisma.userImport.create({
      data: {
        userId,
        title,
        importType: ImportType.paste,
        language: dto.language,
        ingestionStatus: 'processing',
      },
    });

    const run = async () => {
      const chapters = splitTextIntoChapters(text, title);
      const content = await this.createImportContent(userId, title, chapters, dto.language);
      return this.prisma.userImport.update({
        where: { id: userImport.id },
        data: {
          ingestionStatus: 'ready',
          contentId: content.id,
        },
        include: { content: true },
      });
    };

    if (text.length >= ASYNC_PASTE_CHARS) {
      void this.finishInBackground(userImport.id, null, run);
      return this.prisma.userImport.findUniqueOrThrow({
        where: { id: userImport.id },
        include: { content: true },
      });
    }

    try {
      return await run();
    } catch (err) {
      return this.markFailed(userImport.id, null, err, 'Import failed');
    }
  }

  /**
   * URL import: process synchronously for typical pages; still works without Redis/worker.
   */
  async importUrl(userId: string, dto: ImportUrlDto) {
    await this.limits.assertImportAllowed(userId);

    const title = (dto.title?.trim() || titleFromUrl(dto.url)).slice(0, 200);
    const userImport = await this.prisma.userImport.create({
      data: {
        userId,
        title,
        importType: ImportType.url,
        sourceUrl: dto.url,
        language: dto.language,
        ingestionStatus: 'processing',
      },
    });

    const job = await this.prisma.ingestionJob.create({
      data: {
        sourceType: 'url',
        payload: { importId: userImport.id, url: dto.url, title, userId },
        createdById: userId,
        status: 'processing',
      },
    });

    try {
      const extracted = await extractTextFromUrl(dto.url);
      assertMinWords(extracted.text, 'text from URL');
      const finalTitle = (dto.title?.trim() || extracted.detectedTitle || title).slice(0, 200);
      const content = await this.createImportContent(
        userId,
        finalTitle,
        extracted.chapters,
        dto.language,
        dto.url,
      );

      await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: { status: 'ready', contentId: content.id, finishedAt: new Date() },
      });

      return this.prisma.userImport.update({
        where: { id: userImport.id },
        data: {
          title: finalTitle,
          ingestionStatus: 'ready',
          contentId: content.id,
        },
        include: { content: true },
      });
    } catch (err) {
      return this.markFailed(userImport.id, job.id, err, 'URL import failed');
    }
  }

  async importFile(userId: string, file: Express.Multer.File | undefined, dto: ImportFileDto) {
    await this.limits.assertImportAllowed(userId);

    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException(`File exceeds ${formatFileSizeLimit()} limit`);
    }

    const original = file.originalname || 'upload';
    const ext = extname(original).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isPdf = ext === '.pdf' || mime === 'application/pdf';
    const isEpub =
      ext === '.epub' ||
      mime === 'application/epub+zip' ||
      mime === 'application/epub';

    if (!isPdf && !isEpub) {
      throw new BadRequestException('Only PDF and EPUB files are supported');
    }

    const importType = isPdf ? ImportType.pdf : ImportType.epub;
    const sourceType = isPdf ? 'pdf' : 'epub';
    const title =
      (dto.title?.trim() ||
        original.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
        'Uploaded file').slice(0, 200);

    const fileKey = `imports/${userId}/${randomUUID()}${ext || (isPdf ? '.pdf' : '.epub')}`;
    const absPath = join(this.uploadsRoot(), fileKey);
    await mkdir(join(absPath, '..'), { recursive: true });
    await writeFile(absPath, file.buffer);

    const userImport = await this.prisma.userImport.create({
      data: {
        userId,
        title,
        importType,
        fileKey,
        language: dto.language,
        ingestionStatus: 'processing',
      },
    });

    const job = await this.prisma.ingestionJob.create({
      data: {
        sourceType,
        payload: { importId: userImport.id, fileKey, title, userId },
        createdById: userId,
        status: 'processing',
      },
    });

    const buffer = file.buffer;
    const run = async () => {
      const extracted = isPdf
        ? await extractTextFromPdf(buffer)
        : await extractTextFromEpub(buffer);
      assertMinWords(extracted.text, isPdf ? 'text from PDF' : 'text from EPUB');
      const content = await this.createImportContent(userId, title, extracted.chapters, dto.language);

      await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: { status: 'ready', contentId: content.id, finishedAt: new Date() },
      });

      return this.prisma.userImport.update({
        where: { id: userImport.id },
        data: {
          ingestionStatus: 'ready',
          contentId: content.id,
        },
        include: { content: true },
      });
    };

    // Large PDFs / OCR can take a while — return processing and finish in background.
    if (file.size >= ASYNC_FILE_BYTES || isPdf) {
      // Still sync for small text PDFs; only async when large or we expect OCR cost.
      if (file.size >= ASYNC_FILE_BYTES) {
        void this.finishInBackground(userImport.id, job.id, run);
        return this.prisma.userImport.findUniqueOrThrow({
          where: { id: userImport.id },
          include: { content: true },
        });
      }
    }

    try {
      return await run();
    } catch (err) {
      return this.markFailed(userImport.id, job.id, err, 'File import failed');
    }
  }

  private finishInBackground(
    importId: string,
    jobId: string | null,
    run: () => Promise<unknown>,
  ) {
    Promise.resolve()
      .then(() => run())
      .catch((err) => {
        this.logger.warn(`Background import ${importId} failed: ${err instanceof Error ? err.message : err}`);
        return this.markFailed(importId, jobId, err, 'Import failed');
      });
  }

  private async markFailed(
    importId: string,
    jobId: string | null,
    err: unknown,
    fallback: string,
  ) {
    const message = err instanceof Error ? err.message : fallback;
    if (jobId) {
      await this.prisma.ingestionJob.update({
        where: { id: jobId },
        data: { status: 'failed', errorMessage: message, finishedAt: new Date() },
      });
    }
    return this.prisma.userImport.update({
      where: { id: importId },
      data: { ingestionStatus: 'failed', errorMessage: message },
      include: { content: true },
    });
  }

  private async createImportContent(
    userId: string,
    title: string,
    chaptersOrText: ExtractedChapter[] | string,
    language?: string | null,
    sourceUrl?: string | null,
  ) {
    const chapters: ExtractedChapter[] =
      typeof chaptersOrText === 'string'
        ? splitTextIntoChapters(chaptersOrText, title)
        : chaptersOrText;

    if (chapters.length === 0) {
      throw new Error('Import text is empty');
    }

    const segmentCreates: {
      segmentIndex: number;
      title: string;
      plainText: string;
      tokenMap: never;
      sentenceMap: never;
      wordCount: number;
    }[] = [];

    for (const chapter of chapters) {
      const chunks = paginateText(chapter.text);
      for (const chunk of chunks) {
        const { tokenMap, sentenceMap, wordCount } = tokenizeText(chunk.plainText);
        const segmentTitle =
          chunks.length === 1
            ? chapter.title
            : `${chapter.title} · ${chunk.title}`;
        segmentCreates.push({
          segmentIndex: segmentCreates.length,
          title: segmentTitle.slice(0, 200),
          plainText: chunk.plainText,
          tokenMap: tokenMap as never,
          sentenceMap: sentenceMap as never,
          wordCount,
        });
      }
    }

    if (segmentCreates.length === 0) {
      throw new Error('Import text is empty');
    }

    const totalWordCount = segmentCreates.reduce((sum, s) => sum + s.wordCount, 0);
    if (totalWordCount < MIN_IMPORT_WORDS) {
      throw new Error(`Need at least ${MIN_IMPORT_WORDS} words (found ${totalWordCount})`);
    }

    const allLemmas = new Set<string>();
    for (const seg of segmentCreates) {
      for (const t of seg.tokenMap as { isWord?: boolean; lemma?: string | null }[]) {
        if (t.isWord && t.lemma) allLemmas.add(t.lemma);
      }
    }

    const slugBase = slugify(title) || 'import';
    const slug = `${slugBase}-${Date.now()}`;

    return this.prisma.contentItem.create({
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
        sourceUrl: sourceUrl ?? undefined,
        segments: {
          create: segmentCreates,
        },
      },
      include: { segments: true },
    });
  }
}
