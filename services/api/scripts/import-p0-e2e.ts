/* Local-only benchmark: inspect → import(uploadId) → queue → worker. No OpenAI (key unset). */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { basename } from 'path';
import { NestFactory } from '@nestjs/core';
import { ImportWorkerModule } from '../src/modules/imports/import-worker.module';
import { ImportWorker } from '../src/modules/imports/import-worker';
import { ImportsService } from '../src/modules/imports/imports.service';
import { PrismaService } from '../src/prisma/prisma.service';

async function main() {
  if (process.env.OPENAI_API_KEY) throw new Error('unset OPENAI_API_KEY');
  if (!/localhost/.test(process.env.DATABASE_URL ?? '')) throw new Error('local DB only');
  const path = process.argv[2];
  const buf = readFileSync(path);
  let peak = 0;
  const base = process.memoryUsage().rss;
  const s = setInterval(() => (peak = Math.max(peak, process.memoryUsage().rss)), 50);
  const app = await NestFactory.createApplicationContext(ImportWorkerModule, { logger: ['warn', 'error'] });
  const prisma = app.get(PrismaService);
  const imports = app.get(ImportsService);
  const worker = app.get(ImportWorker);
  const user = await prisma.user.create({ data: { email: `e2e-${Date.now()}@test.local`, nativeLanguage: 'uz' } });
  const isPdf = path.endsWith('.pdf');
  const file = { buffer: buf, originalname: basename(path), mimetype: isPdf ? 'application/pdf' : 'application/epub+zip', size: buf.length } as Express.Multer.File;
  const t0 = Date.now();
  const ins = await imports.inspectFile(user.id, file);
  const t1 = Date.now();
  const created: any = await imports.importFile(user.id, undefined, { uploadId: ins.uploadId, language: 'en', title: basename(path) } as any);
  const t2 = Date.now();
  const done = new Promise<any>((res) => (worker.onJobDone = res));
  worker.start(200);
  const r = await done;
  const t3 = Date.now();
  const ui = await prisma.userImport.findUniqueOrThrow({ where: { id: created.id }, include: { queueJob: true } });
  clearInterval(s);
  console.log(JSON.stringify({
    file: basename(path), bytes: buf.length, pageCount: ins.pageCount,
    inspectMs: t1 - t0, importRequestMs: t2 - t1, queueToReadyMs: t3 - t2, ok: r.ok, error: r.error, workerStages: r.timings,
    status: ui.ingestionStatus, noticeCode: ui.noticeCode, attempts: ui.queueJob?.attempts,
    peakRssMB: Math.round(peak / 1e6), rssDeltaMB: Math.round((peak - base) / 1e6),
  }));
  await worker.stop();
  await prisma.user.delete({ where: { id: user.id } });
  await app.close();
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
