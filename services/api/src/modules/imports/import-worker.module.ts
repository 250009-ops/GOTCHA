import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { PrismaModule } from '../../prisma/prisma.module';
import { AiService } from '../ai/ai.service';
import { AtmosClient } from '../billing/atmos.client';
import { ImportCommerceService } from '../billing/import-commerce.service';
import { LimitsService } from '../../services/limits.service';
import { ImportsService } from './imports.service';
import { ImportWorker } from './import-worker';

/** Minimal DI graph for the worker process: no HTTP, no controllers, no unrelated timers. */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(process.cwd(), '.env'), join(process.cwd(), '../../.env')] }),
    PrismaModule,
  ],
  providers: [AiService, AtmosClient, ImportCommerceService, LimitsService, ImportsService, ImportWorker],
  exports: [ImportWorker, ImportsService],
})
export class ImportWorkerModule {}
