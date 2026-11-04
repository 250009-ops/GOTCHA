import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AtmosClient } from './atmos.client';
import { ImportCommerceService } from './import-commerce.service';
import { PricingService } from './pricing.service';
import { EntitlementsService } from './entitlements.service';
import { GooglePlayClient } from './google-play.client';
import { PlayBillingService } from './play-billing.service';

@Module({
  controllers: [BillingController],
  providers: [BillingService, AtmosClient, ImportCommerceService, PricingService, EntitlementsService, GooglePlayClient, PlayBillingService],
  exports: [ImportCommerceService, AtmosClient, PricingService, EntitlementsService, PlayBillingService],
})
export class BillingModule {}
