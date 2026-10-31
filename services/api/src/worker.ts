import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ImportWorkerModule } from './modules/imports/import-worker.module';
import { ImportWorker } from './modules/imports/import-worker';

/** Import queue worker process: `node dist/worker.js` (PM2 app gotcha-import-worker). */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(ImportWorkerModule, { logger: ['log', 'warn', 'error'] });
  app.enableShutdownHooks();
  app.get(ImportWorker).start();
}
bootstrap().catch((err) => {
  new Logger('worker').error(err instanceof Error ? err.stack : err);
  process.exit(1);
});
