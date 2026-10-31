import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ImportWorkerModule } from './modules/imports/import-worker.module';
import { ImportWorker } from './modules/imports/import-worker';

/**
 * Import queue worker process: `node dist/worker.js` (PM2 app gotcha-import-worker).
 * 6.1b: own SIGTERM/SIGINT handler instead of Nest shutdown hooks — Nest runs onModuleDestroy
 * (Prisma $disconnect) BEFORE onApplicationShutdown, which cut in-flight jobs off from the DB.
 * Order here: stop claiming → drain (IMPORT_WORKER_DRAIN_MS) → release unfinished jobs → close → exit 0.
 */
async function bootstrap() {
  const log = new Logger('worker');
  const app = await NestFactory.createApplicationContext(ImportWorkerModule, { logger: ['log', 'warn', 'error'] });
  const worker = app.get(ImportWorker);
  let closing = false;
  const shutdown = async (sig: string) => {
    if (closing) return;
    closing = true;
    log.log(`${sig}: stopping import worker ${worker.workerId}`);
    const hard = setTimeout(() => process.exit(1), 60_000);
    hard.unref();
    try {
      await worker.stop();
      await app.close();
    } catch (err) {
      log.error(err instanceof Error ? err.stack : err);
    }
    log.log('import worker stopped');
    process.exit(0);
  };
  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  worker.start();
}
bootstrap().catch((err) => {
  new Logger('worker').error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
