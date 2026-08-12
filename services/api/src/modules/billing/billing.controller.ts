import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload, Public } from '../../common/decorators';
import { BillingService } from './billing.service';
import { ImportCommerceService } from './import-commerce.service';
import { ImportCheckoutDto, ImportQuoteDto } from './dto/import-commerce.dto';
import { AtmosClient } from './atmos.client';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private billing: BillingService,
    private importCommerce: ImportCommerceService,
    private atmos: AtmosClient,
  ) {}

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUserPayload) {
    return this.billing.getSubscription(user.sub);
  }

  /** Raw plan rows — prefer `/marketing/plans` for Landing feature copy. */
  @Public()
  @Get('plans')
  plans() {
    return this.billing.listPlans();
  }

  @Public()
  @Get('gateway-status')
  gatewayStatus() {
    return {
      paymentGatewayEnabled: this.importCommerce.gatewayEnabled(),
      atmosConfigured: this.atmos.configured(),
      currency: 'UZS',
      ikpu: process.env.ATMOS_IKPU || '10899001001000000',
    };
  }

  @Post('imports/quote')
  quote(@CurrentUser() user: AuthUserPayload, @Body() body: ImportQuoteDto) {
    return this.importCommerce.quote(user.sub, body);
  }

  @Post('imports/checkout')
  checkout(@CurrentUser() user: AuthUserPayload, @Body() body: ImportCheckoutDto) {
    return this.importCommerce.checkout(user.sub, body);
  }

  @Get('imports/payments/:id')
  payment(@CurrentUser() user: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importCommerce.getPayment(user.sub, id);
  }

  /**
   * Atmos Callback API — must return { status: 1 } for Atmos to finalize debit.
   * Configure this URL in the Atmos merchant cabinet:
   * https://gotchaa.uz/api/v1/billing/atmos/webhook
   */
  @Public()
  @Post('atmos/webhook')
  atmosWebhook(@Body() body: Record<string, unknown>) {
    return this.importCommerce.handleAtmosCallback(body ?? {});
  }
}
