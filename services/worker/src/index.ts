import { readFileSync, existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { PDFParse } from 'pdf-parse';
import JSZip from 'jszip';
import { tokenizeText, slugify, paginateText } from './utils/tokenizer';
import { safeFetch } from './safe-fetch';

function loadRootEnv() {
  const candidates = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '../../.env'),
    join(__dirname, '../../../.env'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([^#=]+)=(.*)$/);
      if (m && process.env[m[1].trim()] === undefined) {
        process.env[m[1].trim()] = m[2].trim();
      }
    }
    break;
  }
}

loadRootEnv();

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 100000);
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractEpub(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const names = Object.keys(zip.files)
    .filter((n) => /\.(xhtml|html|htm)$/i.test(n) && !zip.files[n].dir)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts: string[] = [];
  for (const name of names) {
    const html = await zip.files[name].async('string');
    const text = stripHtml(html);
    if (text) parts.push(text);
  }
  return parts.join('\n\n').replace(/\s+/g, ' ').trim().slice(0, 100000);
}

function uploadsRoot() {
  return process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
}

async function bootstrap() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  connection.on('error', () => undefined);

  try {
    await connection.connect();
    await connection.ping();
  } catch {
    console.error(`Redis unavailable at ${redisUrl}.`);
    console.error('Start Docker infra: docker compose -f infra/docker-compose.yml up -d');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$connect();
  } catch {
    console.error('PostgreSQL unavailable (DATABASE_URL should point at localhost:5433 with Docker).');
    await connection.quit();
    process.exit(1);
  }

  const ingestionQueue = new Queue('ingestion', { connection });

  async function createContentFromText(payload: {
    title: string;
    userId: string;
    text: string;
    sourceUrl?: string;
    language?: string;
  }) {
    const chunks = paginateText(payload.text);
    if (chunks.length === 0) {
      throw new Error('No extractable text');
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

    return prisma.contentItem.create({
      data: {
        slug: `${slugify(payload.title)}-${Date.now()}`,
        title: payload.title,
        language: (payload.language as never) ?? 'en',
        contentType: 'user_import',
        contentSource: 'user_import',
        cefrLevel: 'b1',
        wordCount: totalWordCount,
        uniqueWordCount: allLemmas.size,
        publishStatus: 'published',
        publishedAt: new Date(),
        createdById: payload.userId,
        sourceUrl: payload.sourceUrl,
        segments: {
          create: segmentCreates,
        },
      },
    });
  }

  async function markImportFailed(importId: string | undefined, message: string) {
    if (!importId) return;
    await prisma.userImport.update({
      where: { id: importId },
      data: { ingestionStatus: 'failed', errorMessage: message },
    }).catch(() => undefined);
  }

  async function processUrlImport(payload: {
    importId: string;
    url: string;
    title: string;
    userId: string;
  }) {
    await prisma.userImport.update({
      where: { id: payload.importId },
      data: { ingestionStatus: 'processing' },
    });

    const response = await safeFetch(payload.url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) {
      throw new Error(`Could not fetch URL (HTTP ${response.status})`);
    }
    const html = (await response.text()).slice(0, 8 * 1024 * 1024);
    const text = stripHtml(html).slice(0, 100000);

    const content = await createContentFromText({
      title: payload.title,
      userId: payload.userId,
      text,
      sourceUrl: payload.url,
    });

    await prisma.userImport.update({
      where: { id: payload.importId },
      data: { ingestionStatus: 'ready', contentId: content.id },
    });

    return content.id;
  }

  async function processFileImport(payload: {
    importId: string;
    fileKey: string;
    title: string;
    userId: string;
    kind: 'pdf' | 'epub';
  }) {
    await prisma.userImport.update({
      where: { id: payload.importId },
      data: { ingestionStatus: 'processing' },
    });

    const abs = join(uploadsRoot(), payload.fileKey);
    if (!existsSync(abs)) {
      throw new Error('Uploaded file not found on disk');
    }
    const buffer = await readFile(abs);
    const text = payload.kind === 'pdf' ? await extractPdf(buffer) : await extractEpub(buffer);
    if (!text.trim()) {
      throw new Error(payload.kind === 'pdf'
        ? 'No extractable text from PDF (scanned PDFs are not supported)'
        : 'No extractable text from EPUB');
    }

    const content = await createContentFromText({
      title: payload.title,
      userId: payload.userId,
      text,
    });

    await prisma.userImport.update({
      where: { id: payload.importId },
      data: { ingestionStatus: 'ready', contentId: content.id },
    });

    return content.id;
  }

  const worker = new Worker(
    'ingestion',
    async (job) => {
      const jobRecord = await prisma.ingestionJob.findFirst({
        where: { payload: { path: ['importId'], equals: job.data.importId } },
      });

      if (jobRecord) {
        await prisma.ingestionJob.update({
          where: { id: jobRecord.id },
          data: { status: 'processing', attempts: { increment: 1 } },
        });
      }

      try {
        let contentId: string | undefined;
        if (job.name === 'url-import') {
          contentId = await processUrlImport(job.data);
        } else if (job.name === 'pdf-import' || job.name === 'epub-import') {
          contentId = await processFileImport({
            ...job.data,
            kind: job.name === 'pdf-import' ? 'pdf' : 'epub',
          });
        }
        if (jobRecord && contentId) {
          await prisma.ingestionJob.update({
            where: { id: jobRecord.id },
            data: { status: 'ready', contentId, finishedAt: new Date() },
          });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed';
        await markImportFailed(job.data?.importId, message);
        if (jobRecord) {
          await prisma.ingestionJob.update({
            where: { id: jobRecord.id },
            data: {
              status: 'failed',
              errorMessage: message,
              finishedAt: new Date(),
            },
          });
        }
        throw err;
      }
    },
    { connection, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5) },
  );

  async function pollQueuedJobs() {
    try {
      const jobs = await prisma.ingestionJob.findMany({
        where: { status: 'queued' },
        take: 10,
        orderBy: { createdAt: 'asc' },
      });

      for (const job of jobs) {
        const payload = job.payload as {
          importId?: string;
          url?: string;
          title?: string;
          userId?: string;
          fileKey?: string;
        };
        if (!payload.importId) continue;

        if (job.sourceType === 'url' && payload.url) {
          await ingestionQueue.add('url-import', payload, { jobId: job.id });
          await prisma.ingestionJob.update({
            where: { id: job.id },
            data: { status: 'processing' },
          });
        } else if ((job.sourceType === 'pdf' || job.sourceType === 'epub') && payload.fileKey) {
          await ingestionQueue.add(
            job.sourceType === 'pdf' ? 'pdf-import' : 'epub-import',
            { ...payload, kind: job.sourceType },
            { jobId: job.id },
          );
          await prisma.ingestionJob.update({
            where: { id: job.id },
            data: { status: 'processing' },
          });
        }
      }
    } catch (err) {
      console.warn('Poll skipped:', err instanceof Error ? err.message : err);
    }
  }

  console.log('Gotcha ingestion worker started');
  setInterval(pollQueuedJobs, 5000);
  void pollQueuedJobs();

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
