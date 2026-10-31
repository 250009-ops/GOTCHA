import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { createHash, randomUUID } from 'crypto';
import { ContentSource, ContentType, ImportType, IngestionStatus, ModerationStatus, Prisma, PublishStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { assertEnabledLanguage } from '../../common/language-catalog';
import { LimitsService } from '../../services/limits.service';
import { ImportCommerceService } from '../billing/import-commerce.service';
import { AtmosClient } from '../billing/atmos.client';
import { liveReverseEnabled, prepareRetryPayment, settleFailedImportPayment, SettleResult } from '../billing/import-refund';
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
  ExtractedDocument,
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
import { ImportCleanupSource } from './import-ai-cleanup';
import { preparePastedText } from './import-text-cleaner';
import { chaptersHaveRealTitles } from './chapter-split';
import { isGutenbergUrl } from './gutenberg';
import { buildSegmentsFromChapters, resolveLiteraryChapters } from '../admin/content-ingest';
import { buildImportNotices, importNoticeMessage, ImportNotice } from './import-notice';
import { completeImportJob, enqueueImportJob, ImportJobKind, ImportQueueRow, requeueFailedImportJob } from './import-queue';

/** Legacy watchdog for rows created before the queue existed (no import_queue_jobs row). */
const STALE_URL_IMPORT_MS = 6 * 60 * 1000;
const STALE_FILE_IMPORT_MS = 20 * 60 * 1000;
const STALE_URL_MESSAGE =
  'Import timed out. Gutenberg illustrated HTML pages are skipped — we fetch the plain-text book instead. Try again.';
const STALE_FILE_MESSAGE = 'Import timed out while processing the file. Try again, or use a smaller PDF.';

/** Stored uploads from /imports/inspect live this long before the worker sweeps them. */
export const IMPORT_UPLOAD_TTL_MS = 24 * 60 * 60 * 1000;
export const IMPORT_MAX_MANUAL_RETRIES = 3;

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

type QueueInfo = { status: string; attempts: number; maxAttempts: number; lastError: string | null } | null;

export function presentImport<
  T extends { ingestionStatus: string; errorMessage: string | null; manualRetries?: number; queueJob?: QueueInfo },
>(row: T) {
  const pending = row.ingestionStatus === 'queued' || row.ingestionStatus === 'processing' || row.ingestionStatus === 'tokenizing';
  const phase = parseProgressPhase(row.errorMessage);
  const { queueJob, ...rest } = row;
  return {
    ...rest,
    progressPhase: pending ? phase : null,
    errorMessage: pending && phase ? null : row.errorMessage,
    queue: queueJob ? { status: queueJob.status, attempts: queueJob.attempts, maxAttempts: queueJob.maxAttempts } : null,
    canRetry:
      row.ingestionStatus === 'failed' &&
      Boolean(queueJob) &&
      (row.manualRetries ?? 0) < IMPORT_MAX_MANUAL_RETRIES,
  };
}

const IMPORT_INCLUDE = {
  content: true,
  queueJob: { select: { status: true, attempts: true, maxAttempts: true, lastError: true } },
} satisfies Prisma.UserImportInclude;

type FilePayload = { fileKey: string; isPdf: boolean; title: string; language: string; ingestionJobId: string };
type UrlPayload = { url: string; title: string; titleFromUser: boolean; language: string; ingestionJobId: string };
type PastePayload = { textKey: string; title: string; language: string };

/** Permanent errors are not worth re-attempting (bad file, too few words, password, etc.). */
export function isRetryableImportError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/password-protected|No extractable text|No readable HTML|Need at least|too long|too large|Only PDF and EPUB|not supported|paywalled|login-gated|empty/i.test(msg)) {
    return false;
  }
  return true;
}

@Injectable()
export class ImportsService {
  private readonly logger = new Logger(ImportsService.name);

  constructor(
    private prisma: PrismaService,
    private limits: LimitsService,
    private importCommerce: ImportCommerceService,
    private ai: AiService,
    private atmos: AtmosClient,
  ) {}

  private async requirePaymentIfNeeded(
    userId: string,
    paymentId: string | undefined,
    importType: ImportType,
    pages?: number,
  ) {
    const payment = await this.importCommerce.consumePayment(userId, paymentId, importType, pages);
    return payment;
  }

  private uploadsRoot() {
    return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  }

  async list(userId: string, page = 1, pageSize = 20) {
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize) || 20));

    const [items, total, quota, freeAllowance, retryState] = await Promise.all([
      this.prisma.userImport.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
          content: { select: { id: true, title: true, slug: true, wordCount: true } },
          queueJob: { select: { status: true, attempts: true, maxAttempts: true, lastError: true } },
        },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
      this.prisma.userImport.count({ where: { userId } }),
      this.limits.getImportQuota(userId),
      this.importCommerce.learnerAllowance(userId),
      this.importCommerce.importRetryState(userId),
    ]);

    return {
      /** payments-02: a failed paid import → free retry on the same payment, or refund-due. */
      paidImportRetry: retryState,
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

  async get(userId: string, id: string) {
    const row = await this.prisma.userImport.findFirst({ where: { id, userId }, include: IMPORT_INCLUDE });
    if (!row) throw new NotFoundException('Import not found');
    return presentImport(row);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.userImport.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Import not found');

    const contentId = existing.contentId;
    const fileKey = existing.fileKey;

    await this.prisma.$transaction(async (tx) => {
      await tx.userImport.delete({ where: { id } }); // cascades import_queue_jobs
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

  private classifyFile(file: Express.Multer.File) {
    const original = file.originalname || 'upload';
    const ext = extname(original).toLowerCase();
    const mime = (file.mimetype || '').toLowerCase();
    const isPdf = ext === '.pdf' || mime === 'application/pdf';
    const isEpub = ext === '.epub' || mime === 'application/epub+zip' || mime === 'application/epub';
    if (!isPdf && !isEpub) {
      throw new BadRequestException('Only PDF and EPUB files are supported');
    }
    assertPdfOrEpubMagic(file);
    return { original, ext, mime, isPdf };
  }

  private async storeFile(userId: string, ext: string, isPdf: boolean, buffer: Buffer) {
    const fileKey = `imports/${userId}/${randomUUID()}${ext || (isPdf ? '.pdf' : '.epub')}`;
    const absPath = join(this.uploadsRoot(), fileKey);
    await mkdir(join(absPath, '..'), { recursive: true });
    await writeFile(absPath, buffer);
    return fileKey;
  }

  /**
   * Single-upload flow: inspect counts pages AND stores the file. The returned uploadId is passed
   * to /imports/file (and survives the payment redirect) so the bytes are never sent twice.
   */
  async inspectFile(userId: string, file: Express.Multer.File | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException(`File exceeds ${formatFileSizeLimit()} limit`);
    }
    const { original, ext, mime, isPdf } = this.classifyFile(file);

    let pageCount: number;
    try {
      pageCount = await countImportDocumentPages(file.buffer, isPdf ? 'pdf' : 'epub');
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not read this file');
    }

    const fileKey = await this.storeFile(userId, ext, isPdf, file.buffer);
    const upload = await this.prisma.importUpload.create({
      data: {
        userId,
        fileKey,
        originalName: original.slice(0, 300),
        mimeType: mime.slice(0, 120) || (isPdf ? 'application/pdf' : 'application/epub+zip'),
        sizeBytes: file.size,
        sha256: createHash('sha256').update(file.buffer).digest('hex'),
        importType: isPdf ? ImportType.pdf : ImportType.epub,
        pageCount,
        expiresAt: new Date(Date.now() + IMPORT_UPLOAD_TTL_MS),
      },
    });
    return { importType: isPdf ? 'pdf' : 'epub', pageCount, uploadId: upload.id, expiresAt: upload.expiresAt };
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
    // final-6.1b-r2: validate the text BEFORE touching the payment, so bad input never consumes a paid payment.
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
    const payment = await this.requirePaymentIfNeeded(userId, dto.paymentId, ImportType.paste, this.importCommerce.estimatePages({ importType: ImportType.paste, textLength: dto.text?.length ?? 0 }));

    const title = dto.title.trim();
    // Text goes to disk, not the queue row (keeps import_queue_jobs small).
    const textKey = `imports/${userId}/${randomUUID()}.paste.txt`;
    const abs = join(this.uploadsRoot(), textKey);
    await mkdir(join(abs, '..'), { recursive: true });
    await writeFile(abs, text, 'utf8');

    const userImport = await this.prisma.$transaction(async (tx) => {
      const row = await tx.userImport.create({
        data: { userId, title, importType: ImportType.paste, language: importLanguage, fileKey: textKey, ingestionStatus: 'queued' },
      });
      if (payment) await tx.importPayment.update({ where: { id: payment.id }, data: { userImportId: row.id } });
      const payload: PastePayload = { textKey, title, language: importLanguage };
      await enqueueImportJob(tx, { userImportId: row.id, kind: 'paste', payload });
      return row;
    });
    return this.get(userId, userImport.id);
  }

  /** Fetch the page before payment so a dead or too-short URL is never charged. */
  async previewUrl(url: string) {
    let doc: ExtractedDocument;
    try {
      doc = await extractTextFromUrl(url);
      assertMinWords(doc.text, 'page');
      assertMaxChars(doc.text, 'page');
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'Could not read this URL');
    }
    return {
      title: (doc.title || titleFromUrl(url)).slice(0, 200),
      wordCount: countWords(doc.text),
      textLength: doc.text.length,
    };
  }

  /** URL import: always queued (worker process). */
  async importUrl(userId: string, dto: ImportUrlDto) {
    await this.limits.assertImportAllowed(userId);
    const importLanguage = await this.resolveImportLanguage(userId, dto.language);
    const payment = await this.requirePaymentIfNeeded(userId, dto.paymentId, ImportType.url);

    const title = (dto.title?.trim() || titleFromUrl(dto.url)).slice(0, 200);
    const userImport = await this.prisma.$transaction(async (tx) => {
      const row = await tx.userImport.create({
        data: { userId, title, importType: ImportType.url, sourceUrl: dto.url, language: importLanguage, ingestionStatus: 'queued' },
      });
      if (payment) await tx.importPayment.update({ where: { id: payment.id }, data: { userImportId: row.id } });
      const job = await tx.ingestionJob.create({
        data: {
          sourceType: 'url',
          payload: { importId: row.id, url: dto.url, title, userId },
          createdById: userId,
          status: 'queued',
        },
      });
      const payload: UrlPayload = { url: dto.url, title, titleFromUser: Boolean(dto.title?.trim()), language: importLanguage, ingestionJobId: job.id };
      await enqueueImportJob(tx, { userImportId: row.id, kind: 'url', payload });
      return row;
    });
    return this.get(userId, userImport.id);
  }

  /**
   * File import. Accepts either a fresh multipart file or `uploadId` from /imports/inspect
   * (single upload). Never processes inline: stores, enqueues and returns (<1 s server time).
   */
  async importFile(userId: string, file: Express.Multer.File | undefined, dto: ImportFileDto) {
    await this.limits.assertImportAllowed(userId);
    const importLanguage = await this.resolveImportLanguage(userId, dto.language);

    let fileKey: string;
    let isPdf: boolean;
    let original: string;
    let actualPages: number;
    let uploadId: string | null = null;

    if (dto.uploadId) {
      const upload = await this.prisma.importUpload.findFirst({ where: { id: dto.uploadId, userId } });
      if (!upload) throw new NotFoundException('Upload not found. Please choose the file again.');
      if (upload.consumedAt) throw new BadRequestException('This upload was already imported.');
      if (upload.expiresAt.getTime() < Date.now()) {
        throw new BadRequestException('This upload expired. Please choose the file again.');
      }
      fileKey = upload.fileKey;
      isPdf = upload.importType === ImportType.pdf;
      original = upload.originalName;
      actualPages = upload.pageCount; // counted server-side at inspect time
      uploadId = upload.id;
    } else {
      if (!file?.buffer?.length) {
        throw new BadRequestException('File is required');
      }
      if (file.size > MAX_FILE_BYTES) {
        throw new BadRequestException(`File exceeds ${formatFileSizeLimit()} limit`);
      }
      const c = this.classifyFile(file);
      isPdf = c.isPdf;
      original = c.original;
      try {
        actualPages = await countImportDocumentPages(file.buffer, isPdf ? 'pdf' : 'epub');
      } catch (err) {
        throw new BadRequestException(err instanceof Error ? err.message : 'Could not read this file');
      }
      fileKey = '';
      // stored below, after the payment checks pass
    }

    const importType = isPdf ? ImportType.pdf : ImportType.epub;
    const payment = await this.requirePaymentIfNeeded(userId, dto.paymentId, importType, actualPages);
    await this.importCommerce.assertPaymentCoversPages(userId, payment, actualPages, importType);
    const sourceType = isPdf ? 'pdf' : 'epub';
    const title =
      (dto.title?.trim() ||
        original.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() ||
        'Uploaded file').slice(0, 200);

    if (!uploadId) {
      fileKey = await this.storeFile(userId, extname(original).toLowerCase(), isPdf, file!.buffer);
    }

    const userImport = await this.prisma.$transaction(async (tx) => {
      if (uploadId) {
        const consumed = await tx.importUpload.updateMany({
          where: { id: uploadId, consumedAt: null },
          data: { consumedAt: new Date() },
        });
        if (consumed.count !== 1) throw new BadRequestException('This upload was already imported.');
      }
      const row = await tx.userImport.create({
        data: { userId, title, importType, fileKey, language: importLanguage, ingestionStatus: 'queued' },
      });
      if (payment) await tx.importPayment.update({ where: { id: payment.id }, data: { userImportId: row.id } });
      const job = await tx.ingestionJob.create({
        data: { sourceType, payload: { importId: row.id, fileKey, title, userId }, createdById: userId, status: 'queued' },
      });
      const payload: FilePayload = { fileKey, isPdf, title, language: importLanguage, ingestionJobId: job.id };
      await enqueueImportJob(tx, { userImportId: row.id, kind: 'file', payload });
      return row;
    });
    return this.get(userId, userImport.id);
  }

  /**
   * POST /imports/:id/retry — re-queue a failed import from its stored source. Never charges:
   * the original payment stays attached; a refund that was only marked "due" is cancelled.
   */
  async retry(userId: string, id: string) {
    const row = await this.prisma.userImport.findFirst({ where: { id, userId }, include: { queueJob: true } });
    if (!row) throw new NotFoundException('Import not found');
    if (row.ingestionStatus !== IngestionStatus.failed) {
      throw new BadRequestException('Only failed imports can be retried.');
    }
    if (!row.queueJob) {
      throw new BadRequestException('This import was created before retries were available. Please import it again.');
    }
    if (row.manualRetries >= IMPORT_MAX_MANUAL_RETRIES) {
      throw new ForbiddenException(`Retry limit reached (${IMPORT_MAX_MANUAL_RETRIES}). Please contact support.`);
    }
    const pay = await prepareRetryPayment(this.prisma as never, row.id);
    if (!pay.ok) {
      throw new ForbiddenException(
        pay.reason === 'refunded'
          ? 'This import was refunded. Start a new import to try again.'
          : 'A refund for this import is being processed. Please contact support.',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      const ok = await requeueFailedImportJob(tx, row.id);
      if (!ok) throw new BadRequestException('Import is not in a retryable state.');
      await tx.userImport.update({
        where: { id: row.id },
        data: {
          ingestionStatus: 'queued',
          errorMessage: null,
          noticeCode: null,
          noticeData: Prisma.DbNull,
          progressPagesDone: null,
          progressPagesTotal: null,
          manualRetries: { increment: 1 },
        },
      });
    });
    this.logger.log(`Import ${row.id} re-queued by user (retry ${row.manualRetries + 1}, refund mark cancelled=${pay.cancelledRefund})`);
    return this.get(userId, row.id);
  }

  // ───────────────────────── worker side ─────────────────────────

  /**
   * Runs one claimed queue job end to end. The content write, the user_import "ready" update and
   * the queue "done" transition commit in ONE transaction that is fenced on queue ownership.
   */
  async processJob(job: ImportQueueRow, workerId: string): Promise<{ contentId: string; timings: Record<string, number> }> {
    const timings: Record<string, number> = {};
    const t = async <T>(name: string, fn: () => Promise<T> | T): Promise<T> => {
      const s = Date.now();
      try {
        return await fn();
      } finally {
        timings[name] = Date.now() - s;
      }
    };
    const userImport = await this.prisma.userImport.findUnique({ where: { id: job.user_import_id } });
    if (!userImport) throw new Error('Import row was deleted');
    const userId = userImport.userId;
    await this.prisma.userImport.update({ where: { id: userImport.id }, data: { ingestionStatus: 'processing' } });
    const kind = job.kind as ImportJobKind;

    let title = userImport.title;
    let chapters: ExtractedChapter[];
    let sourceUrl: string | undefined;
    let extracted: ExtractedDocument | null = null;
    let ingestionJobId: string | null = null;
    const language = userImport.language;

    if (kind === 'file') {
      const p = job.payload as unknown as FilePayload;
      ingestionJobId = p.ingestionJobId;
      await this.prisma.ingestionJob.update({ where: { id: p.ingestionJobId }, data: { status: 'processing', attempts: job.attempts } }).catch(() => undefined);
      const buffer = await t('read', () => readFile(join(this.uploadsRoot(), p.fileKey)));
      const onProgress = (progress: ImportProgress) => this.updateImportProgress(userImport.id, progress);
      extracted = await t('extract', () =>
        p.isPdf ? extractTextFromPdf(buffer, { onProgress, language }) : extractTextFromEpub(buffer),
      );
      assertMinWords(extracted.text, p.isPdf ? 'text from PDF' : 'text from EPUB');
      const literary = resolveLiteraryChapters(extracted.chapters, title, extracted.text);
      chapters = await t('ai', () =>
        this.shouldSkipAiCleanup(literary)
          ? literary
          : this.aiCleanChapters(literary, p.isPdf ? 'pdf' : 'epub', title, userId, userImport.id),
      );
    } else if (kind === 'url') {
      const p = job.payload as unknown as UrlPayload;
      ingestionJobId = p.ingestionJobId;
      sourceUrl = p.url;
      await this.prisma.ingestionJob.update({ where: { id: p.ingestionJobId }, data: { status: 'processing', attempts: job.attempts } }).catch(() => undefined);
      extracted = await t('extract', () => extractTextFromUrl(p.url));
      assertMinWords(extracted.text, 'text from URL');
      title = ((p.titleFromUser ? p.title : '') || extracted.detectedTitle || p.title).slice(0, 200);
      const literary = resolveLiteraryChapters(extracted.chapters, title, extracted.text);
      chapters = await t('ai', () =>
        this.shouldSkipAiCleanup(literary, p.url) ? literary : this.aiCleanChapters(literary, 'url', title, userId, userImport.id),
      );
    } else {
      const p = job.payload as unknown as PastePayload;
      const text = await t('read', () => readFile(join(this.uploadsRoot(), p.textKey), 'utf8'));
      chapters = await t('extract', () => resolveLiteraryChapters(splitTextIntoChapters(text, title), title, text));
    }

    const notices: ImportNotice[] = extracted ? buildImportNotices(extracted) : [];
    const notice = notices[0] ?? null;
    const prepared = await t('segments', () => this.prepareImportContent(title, chapters));
    const moderation = await this.getModerationSettings();

    const contentId = await t('db_write', () =>
      this.prisma.$transaction(
        async (tx) => {
          const content = await this.writeImportContent(tx, prepared, moderation, {
            userId, title, language, sourceUrl, userImportId: userImport.id,
          });
          const owned = await completeImportJob(tx, job.id, workerId);
          if (!owned) throw new Error('Lost queue ownership (job was reaped) — rolling back');
          await tx.userImport.update({
            where: { id: userImport.id },
            data: {
              title,
              ingestionStatus: 'ready',
              contentId: content.id,
              progressPagesDone: extracted?.pageCount ?? null,
              progressPagesTotal: extracted?.pageCount ?? null,
              noticeCode: notice?.code ?? null,
              noticeData: notice ? ({ notices } as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
              // English fallback for older clients; new clients render noticeCode in uz/ru/en.
              errorMessage: notices.length ? notices.map((n) => importNoticeMessage(n, 'en')).join(' ') : null,
            },
          });
          if (ingestionJobId) {
            await tx.ingestionJob.update({
              where: { id: ingestionJobId },
              data: { status: 'ready', contentId: content.id, finishedAt: new Date() },
            });
          }
          return content.id;
        },
        { timeout: 180_000, maxWait: 30_000 },
      ),
    );
    return { contentId, timings };
  }

  /** Mark one attempt's failure visible to the user while the queue will retry it. */
  async noteAttemptFailed(userImportId: string, err: unknown, willRetry: boolean, attempt: number, maxAttempts: number) {
    if (!willRetry) return;
    const msg = err instanceof Error ? err.message : String(err);
    await this.prisma.userImport
      .updateMany({
        where: { id: userImportId, ingestionStatus: { in: ['queued', 'processing', 'tokenizing'] } },
        data: { ingestionStatus: 'queued', errorMessage: null },
      })
      .catch(() => undefined);
    this.logger.warn(`Import ${userImportId} attempt ${attempt}/${maxAttempts} failed, will retry: ${msg}`);
  }

  /**
   * Terminal failure (attempts exhausted, permanent error, or reaped with no attempts left).
   * Called exactly once per failure by whoever moved the queue row to "failed".
   */
  async finalizeFailure(userImportId: string, err: unknown): Promise<SettleResult> {
    const message = (err instanceof Error ? err.message : String(err || 'Import failed')).slice(0, 1000);
    await this.prisma.userImport
      .updateMany({
        where: { id: userImportId, ingestionStatus: { not: 'ready' } },
        data: { ingestionStatus: 'failed', errorMessage: message },
      })
      .catch(() => undefined);
    const row = await this.prisma.userImport.findUnique({
      where: { id: userImportId },
      include: { queueJob: { select: { payload: true } } },
    });
    const ingestionJobId = (row?.queueJob?.payload as { ingestionJobId?: string } | undefined)?.ingestionJobId;
    if (ingestionJobId) {
      await this.prisma.ingestionJob
        .updateMany({
          where: { id: ingestionJobId, status: { in: ['queued', 'processing', 'tokenizing'] } },
          data: { status: 'failed', errorMessage: message, finishedAt: new Date() },
        })
        .catch(() => undefined);
    }
    const settle = await settleFailedImportPayment(
      this.prisma as never,
      this.importCommerce.importRefundReverser(),
      userImportId,
      `Import failed: ${message}`,
      { liveReverse: liveReverseEnabled() && this.atmos.configured() },
    );
    this.logger.warn(`Import ${userImportId} failed permanently (${message}); payment: ${JSON.stringify(settle)}`);
    return settle;
  }

  /** Worker housekeeping: drop expired, never-imported uploads (file + row). */
  async sweepExpiredUploads(now = new Date()) {
    const rows = await this.prisma.importUpload.findMany({
      where: { consumedAt: null, expiresAt: { lt: now } },
      take: 200,
    });
    for (const r of rows) {
      await unlink(join(this.uploadsRoot(), r.fileKey)).catch(() => undefined);
      await this.prisma.importUpload.delete({ where: { id: r.id } }).catch(() => undefined);
    }
    return rows.length;
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

  /** Legacy (pre-queue) imports only: rows with no import_queue_jobs entry that were mid-flight at deploy. */
  async failStaleLegacyImports() {
    const now = Date.now();
    const pendingStatuses: IngestionStatus[] = [IngestionStatus.queued, IngestionStatus.processing, IngestionStatus.tokenizing];
    try {
      const [urlResult, fileResult] = await Promise.all([
        this.prisma.userImport.updateMany({
          where: {
            ingestionStatus: { in: pendingStatuses },
            importType: { in: [ImportType.url, ImportType.paste] },
            queueJob: { is: null },
            createdAt: { lt: new Date(now - STALE_URL_IMPORT_MS) },
          },
          data: { ingestionStatus: 'failed', errorMessage: STALE_URL_MESSAGE },
        }),
        this.prisma.userImport.updateMany({
          where: {
            ingestionStatus: { in: pendingStatuses },
            importType: { in: [ImportType.pdf, ImportType.epub] },
            queueJob: { is: null },
            createdAt: { lt: new Date(now - STALE_FILE_IMPORT_MS) },
          },
          data: { ingestionStatus: 'failed', errorMessage: STALE_FILE_MESSAGE },
        }),
      ]);
      const n = urlResult.count + fileResult.count;
      if (n > 0) this.logger.warn(`Marked ${n} stale legacy (pre-queue) import(s) as failed`);
      // payments-02: a paid LEGACY import (no queue job) that failed → free retry on the same payment, or refund-due.
      // Queue-owned imports are settled by import-p0's settleFailedImportPayment (importCommerce skips them).
      const settled = await this.importCommerce.settleFailedImports();
      if (settled.retry || settled.refundDue) this.logger.warn(`Paid failed imports: ${settled.retry} released for free retry, ${settled.refundDue} refund-due`);
      return n;
    } catch (err) {
      this.logger.warn(`Legacy stale import sweep failed: ${err instanceof Error ? err.message : err}`);
      return 0;
    }
  }

  private prepareImportContent(title: string, chaptersOrText: ExtractedChapter[] | string) {
    const incoming: ExtractedChapter[] =
      typeof chaptersOrText === 'string' ? [{ title, text: chaptersOrText }] : chaptersOrText;
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
    return { segments, totalWordCount, uniqueWordCount: allLemmas.size };
  }

  private async writeImportContent(
    db: Prisma.TransactionClient,
    prepared: ReturnType<ImportsService['prepareImportContent']>,
    moderation: { contentModerationEnabled: boolean; autoApproveImports: boolean },
    meta: { userId: string; title: string; language?: string | null; sourceUrl?: string | null; userImportId: string },
  ) {
    const { segments, totalWordCount, uniqueWordCount } = prepared;
    const slugBase = slugify(meta.title) || 'import';
    const slug = `${slugBase}-${Date.now()}`;
    // Gate publication on the admin's moderation settings.
    const autoApprove = !moderation.contentModerationEnabled || moderation.autoApproveImports;

    const content = await db.contentItem.create({
      data: {
        slug,
        title: meta.title,
        language: (meta.language as never) ?? 'en',
        contentType: ContentType.user_import,
        contentSource: ContentSource.user_import,
        cefrLevel: 'b1',
        wordCount: totalWordCount,
        uniqueWordCount,
        publishStatus: autoApprove ? PublishStatus.published : PublishStatus.review,
        publishedAt: autoApprove ? new Date() : null,
        createdById: meta.userId,
        sourceUrl: meta.sourceUrl ?? undefined,
      },
    });

    const BATCH = 80;
    for (let i = 0; i < segments.length; i += BATCH) {
      const batch = segments.slice(i, i + BATCH);
      await db.contentSegment.createMany({
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
      await db.moderationQueue.create({
        data: {
          importId: meta.userImportId,
          contentId: content.id,
          reason: 'User-submitted import pending moderation review.',
          status: ModerationStatus.pending,
        },
      });
    }
    return content;
  }
}
