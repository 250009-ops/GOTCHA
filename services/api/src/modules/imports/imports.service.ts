import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { ContentSource, ContentType, ImportType, IngestionStatus, ModerationStatus, PublishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertEnabledLanguage } from '../../common/language-catalog';
import { LimitsService } from '../../services/limits.service';
import { ImportCommerceService } from '../billing/import-commerce.service';
import { AiService } from '../ai/ai.service';
import { slugify } from '../../utils/tokenizer';
import { ImportFileDto, ImportPasteDto, ImportUrlDto } from './dto/imports.dto';
import { assertPdfOrEpubMagic } from '../../common/upload-magic';
import {
  assertMaxChars,
  assertMinWords,
  countImportDocumentPages,
  countWords,
  ExtractedChapter,
  extractTextFromEpub,
  extractTextFromPdf,
  extractTextFromUrl,
  formatFileSizeLimit,
  ImportProgress,
  MAX_FILE_BYTES,
  MIN_IMPORT_WORDS,
  splitTextIntoChapters,
  titleFromUrl,
} from './extract-text';
import { ImportCleanupSource, isImportAiCleanupEnabled } from './import-ai-cleanup';
import { preparePastedText } from './import-text-cleaner';
import { chaptersHaveRealTitles } from './chapter-split';
import { isGutenbergUrl } from './gutenberg';
import {
  buildSegmentsFromChapters,
  resolveLiteraryChapters,
} from '../admin/content-ingest';

/** Above this size, finish processing in the background so the client can poll status. */
const ASYNC_PASTE_CHARS = 40_000;
/** Large EPUBs finish in background; PDFs always async (OCR / many pages). */
const ASYNC_FILE_BYTES = 5 * 1024 * 1024;
/** URL/paste background jobs must not hang the UI if extract stalls or the process restarts. */
const BACKGROUND_URL_TIMEOUT_MS = 4 * 60 * 1000;
const BACKGROUND_FILE_TIMEOUT_MS = 15 * 60 * 1000;
const STALE_URL_IMPORT_MS = 6 * 60 * 1000;
const STALE_FILE_IMPORT_MS = 20 * 60 * 1000;
const STALE_WATCH_MS = 60_000;
const STALE_URL_MESSAGE =
  'Import timed out. Gutenberg illustrated HTML pages are skipped — we fetch the plain-text book instead. Try again.';
const STALE_FILE_MESSAGE = 'Import timed out while processing the file. Try again, or use a smaller PDF.';

/** Stashed on errorMessage while an import is still running — stripped before the client sees it. */
const PROGRESS_PHASE_PREFIX = 'gotcha.progress:';
const PROGRESS_PHASES = ['extract', 'ocr', 'ai'] as const;
type ProgressPhase = (typeof PROGRESS_PHASES)[number];

function encodeProgressPhase(phase: ProgressPhase) {
  return `${PROGRESS_PHASE_PREFIX}${phase}`;
}

function parseProgressPhase(errorMessage: string | null | undefined): ProgressPhase | null {
  if (!errorMessage?.startsWith(PROGRESS_PHASE_PREFIX)) return null;
  const phase = errorMessage.slice(PROGRESS_PHASE_PREFIX.length);
  return (PROGRESS_PHASES as readonly string[]).includes(phase) ? (phase as ProgressPhase) : null;
}

function presentImport<T extends { ingestionStatus: string; errorMessage: string | null }>(row: T) {
  const pending = row.ingestionStatus === 'queued' || row.ingestionStatus === 'processing' || row.ingestionStatus === 'tokenizing';
  const phase = parseProgressPhase(row.errorMessage);
  return {
    ...row,
    progressPhase: pending ? phase : null,
    errorMessage: pending && phase ? null : row.errorMessage,
  };
}

@Injectable()
export class ImportsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportsService.name);
  private staleWatch: ReturnType<typeof setInterval> | undefined;

  constructor(
    private prisma: PrismaService,
    private limits: LimitsService,
    private importCommerce: ImportCommerceService,
    private ai: AiService,
  ) {}

  async onModuleInit() {
    await this.failStaleImports();
    this.staleWatch = setInterval(() => {
      void this.failStaleImports();
    }, STALE_WATCH_MS);
    this.staleWatch.unref?.();
  }

  onModuleDestroy() {
    if (this.staleWatch) clearInterval(this.staleWatch);
  }

  private async requirePaymentIfNeeded(
    userId: string,
    paymentId: string | undefined,
    importType: ImportType,
  ) {
    const payment = await this.importCommerce.consumePayment(userId, paymentId, importType);
    return payment;
  }

  private uploadsRoot() {
    return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  }

  async list(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

    const [items, total, quota, freeAllowance] = await Promise.all([
      this.prisma.userImport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { content: { select: { id: true, title: true, slug: true, wordCount: true } } },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.userImport.count({ where: { userId } }),
      this.limits.getImportQuota(userId),
      this.importCommerce.learnerAllowance(userId),
    ]);

    return {
      items: items.map((item) => presentImport(item)),
      total,
      page: safePage,
      pageSize: safePageSize,
      hasMore: safePage * safePageSize < total,
      importLimit: quota.limit,
      importRemaining: quota.remaining,
      importsUnlimited: quota.unlimited,
      freeAllowance,
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

  async inspectFile(file: Express.Multer.File | undefined) {
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
    assertPdfOrEpubMagic(file);

    try {
      const pageCount = await countImportDocumentPages(file.buffer, isPdf ? 'pdf' : 'epub');
      return { importType: isPdf ? 'pdf' : 'epub', pageCount };
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not read this file');
    }
  }

  /**
   * Reads the admin-configured moderation settings (`/admin/settings`) so import behavior
   * actually reflects them — previously these toggles were persisted but never read
   * anywhere outside the settings page itself (see docs/E2E_AUDIT_REPORT.md).
   * Defaults mirror admin.service.ts's `settings()` defaults.
   */
  private async getModerationSettings() {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: ['contentModerationEnabled', 'autoApproveImports'] } },
    });
    const map: Record<string, unknown> = {};
    for (const row of rows) map[row.key] = row.value;

    const contentModerationEnabled =
      map.contentModerationEnabled !== undefined ? Boolean(map.contentModerationEnabled) : true;
    const autoApproveImports =
      map.autoApproveImports !== undefined ? Boolean(map.autoApproveImports) : false;

    return { contentModerationEnabled, autoApproveImports };
  }

  private async resolveImportLanguage(userId: string, language?: string | null): Promise<import('@prisma/client').AppLanguage> {
    const code = language ?? 'en';
    await assertEnabledLanguage(this.prisma, code, 'Import language');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { nativeLanguage: true },
    });
    if (user?.nativeLanguage === code) {
      throw new BadRequestException('Import language cannot be the same as your native language.');
    }
    return code as import('@prisma/client').AppLanguage;
  }

  async importPaste(userId: string, dto: ImportPasteDto) {
    await this.limits.assertImportAllowed(userId);
    const importLanguage = await this.resolveImportLanguage(userId, dto.language);
    const payment = await this.requirePaymentIfNeeded(userId, dto.paymentId, ImportType.paste);

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
        language: importLanguage,
        ingestionStatus: 'processing',
      },
    });
    if (payment) await this.importCommerce.attachUserImport(payment.id, userImport.id);

    const run = async () => {
      const chapters = resolveLiteraryChapters(splitTextIntoChapters(text, title), title, text);
      const content = await this.createImportContent(
        userId,
        title,
        chapters,
        importLanguage,
        undefined,
        userImport.id,
      );
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
      void this.finishInBackground(userImport.id, null, run, BACKGROUND_URL_TIMEOUT_MS);
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
    const importLanguage = await this.resolveImportLanguage(userId, dto.language);
    const payment = await this.requirePaymentIfNeeded(userId, dto.paymentId, ImportType.url);

    const title = (dto.title?.trim() || titleFromUrl(dto.url)).slice(0, 200);
    const userImport = await this.prisma.userImport.create({
      data: {
        userId,
        title,
        importType: ImportType.url,
        sourceUrl: dto.url,
        language: importLanguage,
        ingestionStatus: 'processing',
      },
    });
    if (payment) await this.importCommerce.attachUserImport(payment.id, userImport.id);

    const job = await this.prisma.ingestionJob.create({
      data: {
        sourceType: 'url',
        payload: { importId: userImport.id, url: dto.url, title, userId },
        createdById: userId,
        status: 'processing',
      },
    });

    const run = async () => {
      const extracted = await extractTextFromUrl(dto.url);
      assertMinWords(extracted.text, 'text from URL');
      const finalTitle = (dto.title?.trim() || extracted.detectedTitle || title).slice(0, 200);
      const literary = resolveLiteraryChapters(extracted.chapters, finalTitle, extracted.text);
      // Match admin literary ingest: Gutenberg / long-form books skip OpenAI cleanup.
      const chapters = this.shouldSkipAiCleanup(literary, dto.url)
        ? literary
        : await this.aiCleanChapters(literary, 'url', finalTitle, userId, userImport.id);
      const content = await this.createImportContent(
        userId,
        finalTitle,
        chapters,
        importLanguage,
        dto.url,
        userImport.id,
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
    };

    // Large book URLs (Gutenberg, .txt) can exceed reverse-proxy timeouts.
    // Article AI cleanup is also backgrounded so nginx does not time out.
    const largeUrl = /gutenberg\.org|archive\.org|\.txt(\?|#|$)/i.test(dto.url);
    if (
      largeUrl ||
      (isImportAiCleanupEnabled() && Boolean(process.env.OPENAI_API_KEY?.trim()))
    ) {
      void this.finishInBackground(userImport.id, job.id, run, BACKGROUND_URL_TIMEOUT_MS);
      return this.prisma.userImport.findUniqueOrThrow({
        where: { id: userImport.id },
        include: { content: true },
      });
    }

    try {
      return await run();
    } catch (err) {
      return this.markFailed(userImport.id, job.id, err, 'URL import failed');
    }
  }

  async importFile(userId: string, file: Express.Multer.File | undefined, dto: ImportFileDto) {
    await this.limits.assertImportAllowed(userId);
    const importLanguage = await this.resolveImportLanguage(userId, dto.language);

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
    assertPdfOrEpubMagic(file);

    const importType = isPdf ? ImportType.pdf : ImportType.epub;
    let actualPages = 1;
    try {
      actualPages = await countImportDocumentPages(file.buffer, isPdf ? 'pdf' : 'epub');
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not read this file');
    }
    const payment = await this.requirePaymentIfNeeded(userId, dto.paymentId, importType);
    await this.importCommerce.assertPaymentCoversPages(userId, payment, actualPages, importType);
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
        language: importLanguage,
        ingestionStatus: 'processing',
      },
    });
    if (payment) await this.importCommerce.attachUserImport(payment.id, userImport.id);

    const job = await this.prisma.ingestionJob.create({
      data: {
        sourceType,
        payload: { importId: userImport.id, fileKey, title, userId },
        createdById: userId,
        status: 'processing',
      },
    });

    const buffer = file.buffer;
    const onProgress = (progress: ImportProgress) =>
      this.updateImportProgress(userImport.id, progress);

    const run = async () => {
      const extracted = isPdf
        ? await extractTextFromPdf(buffer, { onProgress, language: importLanguage })
        : await extractTextFromEpub(buffer);
      const sourceLabel = isPdf ? 'text from PDF' : 'text from EPUB';
      assertMinWords(extracted.text, sourceLabel);
      const literary = resolveLiteraryChapters(extracted.chapters, title, extracted.text);
      const chapters = this.shouldSkipAiCleanup(literary)
        ? literary
        : await this.aiCleanChapters(literary, isPdf ? 'pdf' : 'epub', title, userId, userImport.id);
      const content = await this.createImportContent(
        userId,
        title,
        chapters,
        importLanguage,
        undefined,
        userImport.id,
      );

      await this.prisma.ingestionJob.update({
        where: { id: job.id },
        data: { status: 'ready', contentId: content.id, finishedAt: new Date() },
      });

      return this.prisma.userImport.update({
        where: { id: userImport.id },
        data: {
          ingestionStatus: 'ready',
          contentId: content.id,
          progressPagesDone: extracted.pageCount ?? null,
          progressPagesTotal: extracted.pageCount ?? null,
          errorMessage: extracted.truncatedPages
            ? `Imported first 500 pages (document has more pages).`
            : null,
        },
        include: { content: true },
      });
    };

    // PDFs always async (multi-page extract / OCR must not block the HTTP request).
    // Large EPUBs also finish in the background.
    if (isPdf || file.size >= ASYNC_FILE_BYTES) {
      void this.finishInBackground(userImport.id, job.id, run, BACKGROUND_FILE_TIMEOUT_MS);
      return this.prisma.userImport.findUniqueOrThrow({
        where: { id: userImport.id },
        include: { content: true },
      });
    }

    try {
      return await run();
    } catch (err) {
      return this.markFailed(userImport.id, job.id, err, 'File import failed');
    }
  }

  /**
   * Skip OpenAI for novels the same way admin literary ingest does.
   * Gutenberg / long-form already has titled chapters from splitAccurateChapters.
   */
  private shouldSkipAiCleanup(chapters: ExtractedChapter[], sourceUrl?: string | null): boolean {
    if (sourceUrl && isGutenbergUrl(sourceUrl)) return true;
    if (chaptersHaveRealTitles(chapters) && chapters.length >= 2) return true;
    return countWords(chapters.map((c) => c.text).join('\n\n')) >= 8_000;
  }

  /**
   * AI post-extract cleanup for URL/PDF/EPUB. Always returns usable chapters
   * (falls back to the deterministic extract when AI is off, fails, or over-trims).
   */
  private async aiCleanChapters(
    chapters: ExtractedChapter[],
    source: ImportCleanupSource,
    documentTitle: string,
    userId: string,
    importId?: string,
  ): Promise<ExtractedChapter[]> {
    if (this.shouldSkipAiCleanup(chapters)) {
      return chapters;
    }
    if (importId) {
      await this.setProgressPhase(importId, 'ai');
    }
    try {
      const cleaned = await this.ai.cleanImportChapters(chapters, {
        source,
        documentTitle,
        userId,
      });
      const words = countWords(cleaned.map((c) => c.text).join('\n\n'));
      if (words < MIN_IMPORT_WORDS) {
        this.logger.warn(
          `Import AI cleanup left ${words} words — keeping original extract`,
        );
        return chapters;
      }
      return cleaned;
    } catch (err) {
      this.logger.warn(
        `Import AI cleanup unexpected error — using original extract: ${
          err instanceof Error ? err.message : err
        }`,
      );
      return chapters;
    }
  }

  private async setProgressPhase(importId: string, phase: ProgressPhase) {
    await this.prisma.userImport
      .update({
        where: { id: importId },
        data: { errorMessage: encodeProgressPhase(phase) },
      })
      .catch(() => undefined);
  }

  private async updateImportProgress(importId: string, progress: ImportProgress) {
    await this.prisma.userImport
      .update({
        where: { id: importId },
        data: {
          progressPagesDone: progress.pagesDone,
          progressPagesTotal: progress.pagesTotal,
          ...(progress.phase ? { errorMessage: encodeProgressPhase(progress.phase) } : {}),
        },
      })
      .catch(() => undefined);
  }

  private withTimeout<T>(run: Promise<T>, timeoutMs: number, message: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    });
    return Promise.race([run, timeout]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }

  private finishInBackground(
    importId: string,
    jobId: string | null,
    run: () => Promise<unknown>,
    timeoutMs: number,
  ) {
    const timeoutMessage =
      timeoutMs <= BACKGROUND_URL_TIMEOUT_MS ? STALE_URL_MESSAGE : STALE_FILE_MESSAGE;
    this.withTimeout(Promise.resolve().then(() => run()), timeoutMs, timeoutMessage).catch(
      (err) => {
        this.logger.warn(
          `Background import ${importId} failed: ${err instanceof Error ? err.message : err}`,
        );
        return this.markFailed(importId, jobId, err, 'Import failed');
      },
    );
  }

  private async failStaleImports() {
    const now = Date.now();
    const urlCutoff = new Date(now - STALE_URL_IMPORT_MS);
    const fileCutoff = new Date(now - STALE_FILE_IMPORT_MS);
    const pendingStatuses: IngestionStatus[] = [
      IngestionStatus.queued,
      IngestionStatus.processing,
      IngestionStatus.tokenizing,
    ];

    try {
      const [urlResult, fileResult, urlJobs, fileJobs] = await Promise.all([
        this.prisma.userImport.updateMany({
          where: {
            ingestionStatus: { in: pendingStatuses },
            importType: { in: [ImportType.url, ImportType.paste] },
            createdAt: { lt: urlCutoff },
          },
          data: { ingestionStatus: 'failed', errorMessage: STALE_URL_MESSAGE },
        }),
        this.prisma.userImport.updateMany({
          where: {
            ingestionStatus: { in: pendingStatuses },
            importType: { in: [ImportType.pdf, ImportType.epub] },
            createdAt: { lt: fileCutoff },
          },
          data: { ingestionStatus: 'failed', errorMessage: STALE_FILE_MESSAGE },
        }),
        this.prisma.ingestionJob.updateMany({
          where: {
            status: { in: pendingStatuses },
            finishedAt: null,
            createdAt: { lt: urlCutoff },
            sourceType: { in: ['url', 'paste', 'gutenberg'] },
          },
          data: {
            status: 'failed',
            errorMessage: STALE_URL_MESSAGE,
            finishedAt: new Date(),
          },
        }),
        this.prisma.ingestionJob.updateMany({
          where: {
            status: { in: pendingStatuses },
            finishedAt: null,
            createdAt: { lt: fileCutoff },
            sourceType: { in: ['pdf', 'epub'] },
          },
          data: {
            status: 'failed',
            errorMessage: STALE_FILE_MESSAGE,
            finishedAt: new Date(),
          },
        }),
      ]);
      const n = urlResult.count + fileResult.count + urlJobs.count + fileJobs.count;
      if (n > 0) {
        this.logger.warn(`Marked ${n} stale import record(s) as failed`);
      }
    } catch (err) {
      this.logger.warn(
        `Stale import watchdog failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async markFailed(
    importId: string,
    jobId: string | null,
    err: unknown,
    fallback: string,
  ) {
    const message = err instanceof Error ? err.message : fallback;
    if (jobId) {
      await this.prisma.ingestionJob
        .updateMany({
          where: {
            id: jobId,
            status: { in: ['queued', 'processing', 'tokenizing'] },
          },
          data: { status: 'failed', errorMessage: message, finishedAt: new Date() },
        })
        .catch(() => undefined);
    }
    await this.prisma.userImport
      .updateMany({
        where: {
          id: importId,
          ingestionStatus: { in: ['queued', 'processing', 'tokenizing'] },
        },
        data: { ingestionStatus: 'failed', errorMessage: message },
      })
      .catch(() => undefined);
    return this.prisma.userImport.findUniqueOrThrow({
      where: { id: importId },
      include: { content: true },
    });
  }

  private async createImportContent(
    userId: string,
    title: string,
    chaptersOrText: ExtractedChapter[] | string,
    language?: string | null,
    sourceUrl?: string | null,
    userImportId?: string,
  ) {
    const incoming: ExtractedChapter[] =
      typeof chaptersOrText === 'string'
        ? [{ title, text: chaptersOrText }]
        : chaptersOrText;
    const chapters = resolveLiteraryChapters(incoming, title);
    const segments = buildSegmentsFromChapters(chapters, 'literary');

    if (segments.length === 0) {
      throw new Error('Import text is empty');
    }

    const totalWordCount = segments.reduce((sum, s) => sum + s.wordCount, 0);
    if (totalWordCount < MIN_IMPORT_WORDS) {
      throw new Error(`Need at least ${MIN_IMPORT_WORDS} words (found ${totalWordCount})`);
    }

    const allLemmas = new Set<string>();
    for (const seg of segments) {
      for (const t of seg.tokenMap as { isWord?: boolean; lemma?: string | null }[]) {
        if (t.isWord && t.lemma) allLemmas.add(t.lemma);
      }
    }

    const slugBase = slugify(title) || 'import';
    const slug = `${slugBase}-${Date.now()}`;

    // Gate publication on the admin's moderation settings (previously always published
    // instantly and globally regardless of these settings — see docs/E2E_AUDIT_REPORT.md).
    const { contentModerationEnabled, autoApproveImports } = await this.getModerationSettings();
    const autoApprove = !contentModerationEnabled || autoApproveImports;

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
        publishStatus: autoApprove ? PublishStatus.published : PublishStatus.review,
        publishedAt: autoApprove ? new Date() : null,
        createdById: userId,
        sourceUrl: sourceUrl ?? undefined,
      },
    });

    const BATCH = 80;
    for (let i = 0; i < segments.length; i += BATCH) {
      const batch = segments.slice(i, i + BATCH);
      await this.prisma.contentSegment.createMany({
        data: batch.map((s) => ({
          contentId: content.id,
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

    if (!autoApprove) {
      await this.prisma.moderationQueue.create({
        data: {
          importId: userImportId,
          contentId: content.id,
          reason: 'User-submitted import pending moderation review.',
          status: ModerationStatus.pending,
        },
      });
    }

    return content;
  }
}
