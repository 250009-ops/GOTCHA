import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUserPayload, Public } from '../../common/decorators';
import { BillingService } from './billing.service';
import { ImportCommerceService } from './import-commerce.service';
import { ImportCheckoutDto, ImportQuoteDto, ImportPreApplyDto, ImportApplyDto, ImportCancelDto } from './dto/import-commerce.dto';
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
      storeId: process.env.ATMOS_STORE_ID || null,
      apiBase: (process.env.ATMOS_API_BASE || 'https://apigw.atmos.uz').replace(/\/$/, ''),
      flow: 'merchant-api',
    };
  }

  @Post('imports/quote')
  quote(@CurrentUser() user: AuthUserPayload, @Body() body: ImportQuoteDto) {
    return this.importCommerce.quote(user.sub, body);
  }

  /**
   * Step 1: Create checkout + Atmos transaction.
   * Returns step='card' if payment required — frontend shows card input form.
   */
  @Post('imports/checkout')
  checkout(@CurrentUser() user: AuthUserPayload, @Body() body: ImportCheckoutDto) {
    return this.importCommerce.checkout(user.sub, body);
  }

  /**
   * Step 2: Pre-apply — submit card details to Atmos, triggers OTP to cardholder.
   * Card data is NOT stored — only passed through to Atmos.
   */
  @Post('imports/payments/:id/pre-apply')
  @HttpCode(200)
  preApply(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ImportPreApplyDto,
  ) {
    return this.importCommerce.preApply(user.sub, id, body.cardNumber, body.expiry);
  }

  /**
   * Step 3: Apply — confirm with OTP from SMS.
   */
  @Post('imports/payments/:id/apply')
  @HttpCode(200)
  apply(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ImportApplyDto,
  ) {
    return this.importCommerce.apply(user.sub, id, body.otp);
  }

  /**
   * Resend OTP to cardholder.
   */
  @Post('imports/payments/:id/retry-otp')
  @HttpCode(200)
  retryOtp(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.importCommerce.retryOtp(user.sub, id);
  }

  /**
   * Cancel a pending or confirmed payment.
   */
  @Post('imports/payments/:id/cancel')
  @HttpCode(200)
  cancelPayment(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ImportCancelDto,
  ) {
    return this.importCommerce.cancelPayment(user.sub, id, body.reason);
  }

  @Get('imports/payments/:id')
  payment(@CurrentUser() user: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importCommerce.getPayment(user.sub, id);
  }

  @Get('content/:id/access')
  catalogAccess(@CurrentUser() user: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importCommerce.catalogAccess(user.sub, id, user.isAdmin);
  }

  @Post('content/:id/checkout')
  catalogCheckout(@CurrentUser() user: AuthUserPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.importCommerce.catalogCheckout(user.sub, id, user.isAdmin);
  }

  /**
   * Atmos (and browsers) sometimes probe the callback URL with GET.
   * Real payment callbacks are POST only — see atmosWebhook below.
   */
  @Public()
  @Get('atmos/webhook')
  atmosWebhookProbe() {
    return {
      status: 1,
      message: 'Atmos webhook endpoint ready. Callbacks must use POST.',
      storeId: process.env.ATMOS_STORE_ID || null,
    };
  }

  /**
   * Atmos Callback API — must return HTTP 200 and { status: 1 } for Atmos to finalize debit.
   * Configure this URL in the Atmos merchant cabinet:
   * https://gotchaa.uz/api/v1/billing/atmos/webhook
   */
  @Public()
  @Post('atmos/webhook')
  @HttpCode(200)
  atmosWebhook(@Body() body: Record<string, unknown>) {
    return this.importCommerce.handleAtmosCallback(body ?? {});
  }
}
