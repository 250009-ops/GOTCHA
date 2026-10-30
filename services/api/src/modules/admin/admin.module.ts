import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AiModule } from '../ai/ai.module';
import { BillingModule } from '../billing/billing.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminOpsService } from './admin-ops.service';

@Module({
  imports: [AuthModule, AiModule, BillingModule],
  controllers: [AdminController],
  providers: [AdminService, AdminOpsService],
})
export class AdminModule {}
