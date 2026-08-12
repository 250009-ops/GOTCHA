import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AtmosClient } from './atmos.client';
import { ImportCommerceService } from './import-commerce.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, AtmosClient, ImportCommerceService],
  exports: [ImportCommerceService, AtmosClient],
})
export class BillingModule {}
