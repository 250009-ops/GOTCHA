import { Module } from '@nestjs/common';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { ReportRetentionJob } from './report-retention';

@Module({ controllers: [SafetyController], providers: [SafetyService, ReportRetentionJob] })
export class SafetyModule {}
