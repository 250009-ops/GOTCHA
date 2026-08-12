import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { LimitsService } from '../../services/limits.service';
import { BillingModule } from '../billing/billing.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [BillingModule, AiModule],
  controllers: [ImportsController],
  providers: [ImportsService, LimitsService],
})
export class ImportsModule {}
