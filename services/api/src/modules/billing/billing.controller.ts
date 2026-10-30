import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Query, UnauthorizedException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { StorePlatform } from '@prisma/client';
import { EntitlementsService } from './entitlements.service';
import { PlayBillingService, playAccountId } from './play-billing.service';
import { GooglePlayClient } from './google-play.client';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CurrentUser, AuthUserPayload, Public } from '../../common/decorators';
import { BillingService } from './billing.service';
import { ImportCommerceService } from './import-commerce.service';
import { ImportCheckoutDto, ImportQuoteDto, ImportPreApplyDto, ImportApplyDto, ImportCancelDto, CatalogCheckoutDto, VerifyPlayPurchaseDto } from './dto/import-commerce.dto';
import { AtmosClient } from './atmos.client';

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(
    private billing: BillingService,
    private importCommerce: ImportCommerceService,
    private atmos: AtmosClient,
    private entitlements: EntitlementsService,
    private playBilling: PlayBillingService,
    private play: GooglePlayClient,
  ) {}

  // ---------------------------------------------------------------- unified entitlements + Google Play

  /** Everything the user owns from any source (web Atmos, Android Play, admin). Clients call this at login. */
  @Get('entitlements')
  myEntitlements(@CurrentUser() user: AuthUserPayload) {
    return this.entitlements.forUser(user.sub);
  }

  /** SKUs for the app to query from Play, plus the account id to pass as obfuscatedAccountId. */
  @Get('play/products')
  async playProducts(@CurrentUser() user: AuthUserPayload) {
    return { obfuscatedAccountId: playAccountId(user.sub), products: await this.playBilling.storeProducts(StorePlatform.google_play) };
  }

  @Get('play/books/:contentId')
  playBookSku(@Param('contentId', ParseUUIDPipe) contentId: string) {
    return this.playBilling.skuForBook(contentId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('play/verify')
  @HttpCode(200)
  verifyPlay(@CurrentUser() user: AuthUserPayload, @Body() body: VerifyPlayPurchaseDto) {
    return this.playBilling.verify(user.sub, body);
  }

  /** Real-time developer notifications (Cloud Pub/Sub push). 2xx = ack; 401/5xx = Pub/Sub retries. */
  @Public()
  @SkipThrottle()
  @Post('play/rtdn')
  @HttpCode(204)
  async playRtdn(@Headers('authorization') auth: string | undefined, @Query('token') token: string | undefined, @Body() body: { message?: { data?: string } }) {
    if (!(await this.play.verifyPush(auth, token))) throw new UnauthorizedException();
    await this.playBilling.handleRtdn(body);
  }

  @Get('subscription')
  subscription(@CurrentUser() user: AuthUserPayload) {
    return this.billing.getSubscription(user.sub);
  }

  /** Active plans from the DB (admin-editable): localized name, price in UZS, period, feature keys. */
  @Public()
  @Get('plans')
  plans(@Query('lang') lang?: string) {
    return this.billing.listPlans(lang === 'ru' || lang === 'uz' ? lang : 'en');
  }

  @Public()
  @Get('gateway-status')
  gatewayStatus() {
    return {
      paymentGatewayEnabled: this.importCommerce.gatewayEnabled(),
      atmosConfigured: this.atmos.configured(),
      currency: 'UZS',
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
  catalogCheckout(
    @CurrentUser() user: AuthUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CatalogCheckoutDto = {},
  ) {
    return this.importCommerce.catalogCheckout(user.sub, id, user.isAdmin, body?.promoCode);
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
    };
  }

  /**
   * Atmos Callback API — must return HTTP 200 and { status: 1 } for Atmos to finalize debit.
   * Configure this URL in the Atmos merchant cabinet:
   * https://gotchaa.uz/api/v1/billing/atmos/webhook
   */
  @Public()
  @SkipThrottle()
  @Post('atmos/webhook')
  @HttpCode(200)
  atmosWebhook(@Body() body: Record<string, unknown>) {
    return this.importCommerce.handleAtmosCallback(body ?? {});
  }
}
