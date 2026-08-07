import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { tokenizeText, slugify, paginateText } from './utils/tokenizer';

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

    const response = await fetch(payload.url);
    const html = await response.text();
    // Cap raw extract; pagination still splits into ~100-word reader pages.
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100000);

    const chunks = paginateText(text);
    if (chunks.length === 0) {
      throw new Error('No extractable text from URL');
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

    const content = await prisma.contentItem.create({
      data: {
        slug: `${slugify(payload.title)}-${Date.now()}`,
        title: payload.title,
        language: 'en',
        contentType: 'user_import',
        contentSource: 'user_import',
        cefrLevel: 'b1',
        wordCount: totalWordCount,
        uniqueWordCount: allLemmas.size,
        publishStatus: 'published',
        publishedAt: new Date(),
        createdById: payload.userId,
        sourceUrl: payload.url,
        segments: {
          create: segmentCreates,
        },
      },
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
        if (job.name === 'url-import') {
          const contentId = await processUrlImport(job.data);
          if (jobRecord) {
            await prisma.ingestionJob.update({
              where: { id: jobRecord.id },
              data: { status: 'ready', contentId, finishedAt: new Date() },
            });
          }
        }
      } catch (err) {
        if (jobRecord) {
          await prisma.ingestionJob.update({
            where: { id: jobRecord.id },
            data: {
              status: 'failed',
              errorMessage: err instanceof Error ? err.message : 'Failed',
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
        const payload = job.payload as { importId?: string; url?: string; title?: string; userId?: string };
        if (job.sourceType === 'url' && payload.importId) {
          await ingestionQueue.add('url-import', payload, { jobId: job.id });
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
