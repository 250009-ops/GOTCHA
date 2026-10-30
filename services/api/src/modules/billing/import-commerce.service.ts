import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  Optional,
  OnModuleDestroy,
  OnModuleInit,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ImportPaymentStatus, ImportType, Prisma, PurchaseStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { formatIsAllowed, normalizeAllowedFormats, normalizeImportFormat } from '../../common/import-format';
import { MAX_BILLABLE_PAGES } from '../imports/pdf-page-count';
import { PrismaService } from '../../prisma/prisma.service';
import { AtmosClient, validateCardForAtmos } from './atmos.client';
import { PricingService, promoDiscountTiyins } from './pricing.service';
import {
  catalogAccessGranted,
  catalogContentIdFromFormat,
  catalogPaymentFormat,
  catalogPriceUzs,
  paidCatalogIds,
  requiresCatalogPayment,
} from '../content/catalog-access';

function envFlagTrue(value: string | undefined): boolean {
  const v = (value ?? '').trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

/** ~500 words / page ≈ 3000 chars as a conservative page estimate. */
const CHARS_PER_PAGE = 3000;
const WORDS_PER_PAGE = 500;

export type ImportQuoteInput = {
  importType: ImportType;
  contentFormat?: string;
  textLength?: number;
  wordCount?: number;
  pageCount?: number;
  promoCode?: string;
};

export type ImportQuoteResult = {
  gatewayEnabled: boolean;
  importType: ImportType;
  contentFormat: string;
  estimatedPages: number;
  tier: { id: string; label: string; minPages: number; maxPages: number | null; priceUzs: number } | null;
  amountUzs: number;
  amountTiyins: number;
  currency: 'UZS';
  isFree: boolean;
  freeReason: string | null;
  requiresPayment: boolean;
  /** Minimum payment amount in UZS (soʻm) required by Atmos. */
  minAmountUzs: number;
  /** True if amountUzs < minAmountUzs — payment will fail. */
  belowMinimum: boolean;
  freeLimits: LearnerImportAllowance;
  /** Price before the promo (UZS); equals amountUzs when no promo applies. */
  listAmountUzs: number;
  discountUzs: number;
  promo: { id: string; code: string } | null;
};

export type LearnerImportAllowance = {
  gatewayEnabled: boolean;
  resetCycle: string;
  allowedFormats: string[];
  dailyFreeImportsPerUser: number;
  dailyFreeUsed: number;
  dailyFreeRemaining: number;
  monthlyFreePageLimit: number;
  monthlyPagesUsed: number;
  monthlyPagesRemaining: number;
};

export type CheckoutResult = {
  quote: ImportQuoteResult;
  paymentId: string;
  account: string;
  transactionId: number | null;
  status: string;
  isFree: boolean;
  /** Step for Atmos flow: 'done' (free), 'card' (need card input), 'otp' (need OTP), 'paid' */
  step: 'done' | 'card' | 'otp' | 'paid';
};

@Injectable()
export class ImportCommerceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportCommerceService.name);
  private reconcileTimer?: NodeJS.Timeout;

  onModuleInit() {
    const mode = this.atmos.mode();
    if (this.gatewayEnabled() && mode === null) {
      this.logger.warn('ATMOS_SANDBOX is unset while payments are enabled: local-only refunds are refused (set it explicitly).');
    } else {
      this.logger.log(`Atmos mode: ${mode ?? 'unset'}`);
    }
    if (process.env.NODE_ENV !== 'test') {
      this.reconcileTimer = setInterval(() => void this.reconcileStaleRefunds().catch(() => undefined), 10 * 60_000);
      this.reconcileTimer.unref?.();
    }
  }

  onModuleDestroy() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
  }

  constructor(
    private prisma: PrismaService,
    private atmos: AtmosClient,
    @Optional() private pricing?: PricingService,
  ) {}

  gatewayEnabled(): boolean {
    if (envFlagTrue(process.env.IMPORTS_UNLIMITED) || envFlagTrue(process.env.DEV_UNLIMITED_IMPORTS)) {
      return false;
    }
    return envFlagTrue(process.env.PAYMENT_GATEWAY_ENABLED);
  }

  mapImportTypeToFormat(importType: ImportType, contentFormat?: string): string {
    if (contentFormat?.trim()) return normalizeImportFormat(contentFormat);
    switch (importType) {
      case ImportType.pdf:
      case ImportType.epub:
        return 'ebook';
      case ImportType.url:
        return 'article';
      case ImportType.paste:
      default:
        return 'article';
    }
  }

  estimatePages(input: ImportQuoteInput): number {
    if (input.pageCount != null && input.pageCount > 0) {
      return Math.max(1, Math.min(MAX_BILLABLE_PAGES, Math.floor(input.pageCount)));
    }
    if (input.wordCount != null && input.wordCount > 0) {
      return Math.max(1, Math.min(MAX_BILLABLE_PAGES, Math.ceil(input.wordCount / WORDS_PER_PAGE)));
    }
    if (input.textLength != null && input.textLength > 0) {
      return Math.max(1, Math.min(MAX_BILLABLE_PAGES, Math.ceil(input.textLength / CHARS_PER_PAGE)));
    }
    return 1;
  }

  async getFreeLimits() {
    const row = await this.prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } });
    const defaults = {
      dailyFreeImportsPerUser: 3,
      monthlyFreePageLimit: 50,
      allowedFormats: ['article', 'news'] as string[],
      resetCycle: 'monthly',
      allowRollover: true,
    };
    if (!row?.value || typeof row.value !== 'object') return defaults;
    const merged = { ...defaults, ...(row.value as object) } as typeof defaults;
    return {
      ...merged,
      allowedFormats: normalizeAllowedFormats(merged.allowedFormats),
      resetCycle: ['daily', 'monthly', 'yearly'].includes(merged.resetCycle) ? merged.resetCycle : 'monthly',
      allowRollover: false,
    };
  }

  private startOfUtcDay(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private startOfUtcMonth(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  private startOfUtcYear(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  }

  private pageWindowStart(resetCycle: string) {
    if (resetCycle === 'daily') return this.startOfUtcDay();
    if (resetCycle === 'yearly') return this.startOfUtcYear();
    return this.startOfUtcMonth();
  }

  async freeUsage(userId: string, resetCycle = 'monthly', excludePaymentId?: string) {
    const dayStart = this.startOfUtcDay();
    const pageStart = this.pageWindowStart(resetCycle);
    const exclude = excludePaymentId ? { id: { not: excludePaymentId } } : {};

    const [dailyFreeUsed, monthFreePayments] = await Promise.all([
      this.prisma.importPayment.count({
        where: {
          userId,
          status: ImportPaymentStatus.paid,
          amountTiyins: 0,
          paidAt: { gte: dayStart },
          ...exclude,
        },
      }),
      this.prisma.importPayment.findMany({
        where: {
          userId,
          status: ImportPaymentStatus.paid,
          amountTiyins: 0,
          paidAt: { gte: pageStart },
          ...exclude,
        },
        select: { estimatedPages: true },
      }),
    ]);

    const monthlyPagesUsed = monthFreePayments.reduce((sum, p) => sum + p.estimatedPages, 0);
    return { dailyFreeUsed, monthlyPagesUsed };
  }

  /** Live free-import pool for the student panel. Same numbers admin saves on Import & Pricing. */
  async learnerAllowance(userId: string, excludePaymentId?: string): Promise<LearnerImportAllowance> {
    const freeLimits = await this.getFreeLimits();
    const usage = await this.freeUsage(userId, freeLimits.resetCycle, excludePaymentId);
    const dailyCap = Math.max(0, Math.floor(Number(freeLimits.dailyFreeImportsPerUser) || 0));
    const pageCap = Math.max(0, Math.floor(Number(freeLimits.monthlyFreePageLimit) || 0));
    return {
      gatewayEnabled: this.gatewayEnabled(),
      resetCycle: freeLimits.resetCycle,
      allowedFormats: freeLimits.allowedFormats,
      dailyFreeImportsPerUser: dailyCap,
      dailyFreeUsed: usage.dailyFreeUsed,
      dailyFreeRemaining: Math.max(0, dailyCap - usage.dailyFreeUsed),
      monthlyFreePageLimit: pageCap,
      monthlyPagesUsed: usage.monthlyPagesUsed,
      monthlyPagesRemaining: Math.max(0, pageCap - usage.monthlyPagesUsed),
    };
  }

  async findTier(pages: number) {
    const tiers = await this.prisma.importPageTier.findMany({
      where: { active: true },
      orderBy: [{ minPages: 'asc' }, { sortOrder: 'asc' }],
    });
    return (
      tiers.find((t) => pages >= t.minPages && (t.maxPages == null || pages <= t.maxPages)) ?? null
    );
  }

  async quote(
    userId: string,
    input: ImportQuoteInput,
    opts?: { excludePaymentId?: string },
  ): Promise<ImportQuoteResult> {
    const importType = input.importType;
    const contentFormat = this.mapImportTypeToFormat(importType, input.contentFormat);
    const estimatedPages = this.estimatePages(input);
    const allowance = await this.learnerAllowance(userId, opts?.excludePaymentId);
    const tier = await this.findTier(estimatedPages);
    const priceUzs = tier ? Number(tier.priceUsd) : 0;
    const amountTiyins = Math.max(0, Math.round(priceUzs * 100));

    const gatewayEnabled = allowance.gatewayEnabled;
    let isFree = !gatewayEnabled;
    let freeReason: string | null = gatewayEnabled ? null : 'Payment gateway disabled (unlimited imports)';

    if (gatewayEnabled) {
      const formatOk = formatIsAllowed(allowance.allowedFormats, contentFormat);
      const underDaily = allowance.dailyFreeUsed < allowance.dailyFreeImportsPerUser;
      const underMonthlyPages = allowance.monthlyPagesUsed + estimatedPages <= allowance.monthlyFreePageLimit;
      if (formatOk && underDaily && underMonthlyPages) {
        isFree = true;
        freeReason = 'Within free import allowance';
      } else if (!tier) {
        freeReason = 'This length is not covered by a page tier';
      }
    }

    // Minimum amount required by Atmos (configurable, default 500 soʻm)
    const minAmountTiyins = this.atmos.minAmountTiyins();
    const minAmountUzs = Math.ceil(minAmountTiyins / 100);
    // Promo (admin-managed): only on a payable quote; capped at 70% and never below the Atmos minimum.
    let promo: { id: string; code: string } | null = null;
    let discountTiyins = 0;
    if (input.promoCode?.trim() && !isFree && gatewayEnabled && amountTiyins > 0 && this.pricing) {
      const p = await this.pricing.resolvePromo(input.promoCode, userId, 'imports');
      discountTiyins = promoDiscountTiyins(amountTiyins, p, minAmountTiyins);
      promo = { id: p.id, code: p.code };
    }
    const chargedTiyins = amountTiyins - discountTiyins;
    const effectiveAmount = isFree ? 0 : Math.round(chargedTiyins / 100);
    const belowMinimum = !isFree && effectiveAmount > 0 && effectiveAmount < minAmountUzs;

    return {
      gatewayEnabled,
      importType,
      contentFormat,
      estimatedPages,
      tier: tier
        ? {
            id: tier.id,
            label: tier.label,
            minPages: tier.minPages,
            maxPages: tier.maxPages,
            priceUzs,
          }
        : null,
      amountUzs: isFree ? 0 : effectiveAmount,
      amountTiyins: isFree ? 0 : chargedTiyins,
      listAmountUzs: isFree ? 0 : priceUzs,
      discountUzs: isFree ? 0 : Math.round(discountTiyins / 100),
      promo: isFree ? null : promo,
      currency: 'UZS',
      isFree,
      freeReason,
      requiresPayment: gatewayEnabled && !isFree,
      minAmountUzs,
      belowMinimum,
      freeLimits: allowance,
    };
  }

  /**
   * Step 1: Create checkout + Atmos transaction (no card data yet).
   * Returns step='card' if payment is required — frontend shows card input form.
   */
  async checkout(
    userId: string,
    input: ImportQuoteInput & { platform?: 'web' | 'android' },
  ): Promise<CheckoutResult> {
    const quote = await this.quote(userId, input);

    if (!quote.requiresPayment) {
      const account = `free_${randomUUID().replace(/-/g, '')}`;
      const payment = await this.prisma.importPayment.create({
        data: {
          userId,
          status: ImportPaymentStatus.paid,
          importType: quote.importType,
          contentFormat: quote.contentFormat,
          estimatedPages: quote.estimatedPages,
          tierId: quote.tier?.id,
          amountTiyins: 0,
          account,
          paidAt: new Date(),
        },
      });
      return {
        quote,
        paymentId: payment.id,
        account: payment.account,
        transactionId: null,
        status: payment.status,
        isFree: true,
        step: 'done',
      };
    }

    if (!this.atmos.configured()) {
      throw new ServiceUnavailableException('Atmos payment gateway is not configured');
    }
    if (quote.amountTiyins <= 0) {
      throw new BadRequestException(
        'This import length is not priced yet. Try a shorter document or try again later.',
      );
    }

    // Safety net: pricing should be validated in admin; never expose Atmos minimum details to learners.
    const minTiyins = this.atmos.minAmountTiyins();
    if (quote.amountTiyins < minTiyins) {
      throw new BadRequestException(
        'Payment could not be processed for this import. Please try again later or contact support.',
      );
    }

    const account = `imp_${randomUUID().replace(/-/g, '')}`;
    
    // Create Atmos transaction
    const atmosTx = await this.atmos.createTransaction({
      account,
      amountTiyins: quote.amountTiyins,
    });

    const payment = await this.prisma.importPayment.create({
      data: {
        userId,
        status: ImportPaymentStatus.pending,
        importType: quote.importType,
        contentFormat: quote.contentFormat,
        estimatedPages: quote.estimatedPages,
        tierId: quote.tier?.id,
        amountTiyins: quote.amountTiyins,
        listAmountTiyins: quote.listAmountUzs * 100,
        promoCodeId: quote.promo?.id ?? null,
        account,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        providerPaymentId: String(atmosTx.transactionId),
        rawCreateJson: atmosTx.raw as Prisma.InputJsonValue,
      },
    });

    return {
      quote,
      paymentId: payment.id,
      account: payment.account,
      transactionId: atmosTx.transactionId,
      status: payment.status,
      isFree: false,
      step: 'card',
    };
  }

  /**
   * Step 2: Pre-apply — send card details to Atmos, trigger OTP.
   * Called after user enters card number and expiry in frontend.
   * Card data is NOT stored — only passed through to Atmos.
   */
  async preApply(
    userId: string,
    paymentId: string,
    cardNumber: string,
    expiry: string,
  ): Promise<{ paymentId: string; maskedPhone?: string; step: 'otp' }> {
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === ImportPaymentStatus.paid) {
      throw new BadRequestException('Payment is already completed');
    }
    if (!payment.providerPaymentId) {
      throw new BadRequestException('Transaction not initialized');
    }

    const transactionId = Number(payment.providerPaymentId);
    const normalized = validateCardForAtmos(cardNumber, expiry);
    const result = await this.atmos.preApplyTransaction({
      transactionId,
      cardNumber: normalized.cardNumber,
      expiry: normalized.expiry,
    });

    if (result.transactionId !== transactionId) {
      await this.prisma.importPayment.update({
        where: { id: payment.id },
        data: { providerPaymentId: String(result.transactionId) },
      });
    }

    return {
      paymentId,
      maskedPhone: result.maskedPhone,
      step: 'otp',
    };
  }

  /**
   * Step 3: Apply — confirm with OTP.
   * Called after user enters the OTP received via SMS.
   */
  async apply(
    userId: string,
    paymentId: string,
    otp: string,
  ): Promise<{ paymentId: string; status: string; ofdUrl?: string; step: 'paid' | 'otp' | 'card' }> {
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === ImportPaymentStatus.paid) {
      return { paymentId, status: 'paid', step: 'paid' };
    }
    // REVIEW B3: never charge a cancelled/failed/expired/refunded payment.
    if (payment.status !== ImportPaymentStatus.pending) {
      throw new ConflictException({ message: `Payment is ${payment.status}.`, code: 'payment_not_pending' });
    }
    if (!payment.providerPaymentId) {
      throw new BadRequestException('Transaction not initialized');
    }

    const transactionId = Number(payment.providerPaymentId);
    
    try {
      const result = await this.atmos.applyTransaction({
        transactionId,
        otp,
      });

      if (result.confirmed) {
        const ok = await this.transitionToPaid(payment.id, { ofdUrl: result.ofdUrl, raw: result.raw });
        if (!ok) {
          // Cancelled while the OTP was in flight: the card was charged, so give the money back.
          await this.reverseOrFlag(payment.id, transactionId, 'Payment was cancelled before confirmation');
          throw new ConflictException({ message: 'This payment was cancelled; the charge is being reversed.', code: 'payment_not_pending' });
        }

        return {
          paymentId,
          status: 'paid',
          ofdUrl: result.ofdUrl,
          step: 'paid',
        };
      }
    } catch (err) {
      // If OTP fails, user can retry with new card
      throw err;
    }

    return { paymentId, status: 'pending', step: 'otp' };
  }

  /**
   * Resend OTP to cardholder.
   */
  async retryOtp(
    userId: string,
    paymentId: string,
  ): Promise<{ paymentId: string; step: 'otp' }> {
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === ImportPaymentStatus.paid) {
      throw new BadRequestException('Payment is already completed');
    }
    if (!payment.providerPaymentId) {
      throw new BadRequestException('Transaction not initialized');
    }

    const transactionId = Number(payment.providerPaymentId);
    await this.atmos.retryOtp(transactionId);

    return { paymentId, step: 'otp' };
  }

  /**
   * Learner cancel: only a *pending* payment can be cancelled (BUG-06/07). Paid payments are refunded by an admin
   * (refundPaidPayment); refunded/failed/expired payments are never rewritten.
   */
  async cancelPayment(
    userId: string,
    paymentId: string,
    reason?: string,
  ): Promise<{ paymentId: string; status: string }> {
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== ImportPaymentStatus.pending) {
      throw new ConflictException({
        message: payment.status === ImportPaymentStatus.paid
          ? 'Paid payments can only be refunded by support.'
          : `Payment is already ${payment.status}.`,
        code: payment.status === ImportPaymentStatus.paid ? 'refund_requires_support' : 'payment_not_pending',
      });
    }
    // Conditional update: a webhook may have marked it paid in the meantime.
    const { count } = await this.prisma.importPayment.updateMany({
      where: { id: payment.id, status: ImportPaymentStatus.pending },
      data: { status: ImportPaymentStatus.failed, cancelReason: reason?.slice(0, 500) ?? 'learner_cancelled' },
    });
    if (count === 0) throw new ConflictException({ message: 'Payment status changed; refresh and try again.', code: 'payment_not_pending' });
    // B3: an OTP-less transaction may already be confirmed at Atmos (race with the webhook). Check once and give
    // the money back if so; apply() now refuses non-pending payments, so the OTP can no longer charge the card.
    const tx = Number(payment.providerPaymentId);
    if (Number.isFinite(tx) && tx > 0 && this.atmos.configured()) {
      const remote = await this.atmos.getTransaction(tx).catch(() => null);
      if (remote?.confirmed) await this.reverseOrFlag(payment.id, tx, 'Cancelled by learner');
    }
    return { paymentId, status: 'cancelled' };
  }

  /**
   * Refund a paid payment (REVIEW B2). Claim first (paid→refunding), then reverse at Atmos with the payment id as
   * idempotency key, then in ONE transaction: refunding→refunded, revoke only the access this payment granted,
   * and write the AuditLog. A failed reverse rolls the claim back to paid and surfaces the error.
   * Local-only refunds (no transaction to reverse) are allowed only when Atmos is explicitly in test mode (M1).
   */
  async refundPaidPayment(
    paymentId: string,
    opts: { reason: string; actorId: string | null; action?: string; idempotencyKey?: string },
  ) {
    const payment = await this.prisma.importPayment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === ImportPaymentStatus.refunded) {
      return { paymentId, status: ImportPaymentStatus.refunded, reversedAtAtmos: null, accessRevoked: 0, alreadyRefunded: true };
    }
    if (payment.status !== ImportPaymentStatus.paid) {
      throw new ConflictException({ message: `Only paid payments can be refunded (status: ${payment.status}).`, code: 'payment_not_paid' });
    }
    const transactionId = Number(payment.providerPaymentId);
    const hasTx = Number.isFinite(transactionId) && transactionId > 0 && payment.amountTiyins > 0;
    const mode = this.atmos.mode();
    if (!hasTx && mode !== 'test' && payment.amountTiyins > 0) {
      throw new ConflictException({ message: 'No Atmos transaction to reverse; refund in the Atmos cabinet first.', code: 'no_provider_transaction' });
    }
    if (hasTx && !this.atmos.configured()) {
      throw new ServiceUnavailableException('Atmos is not configured; cannot reverse the charge.');
    }

    const claim = await this.prisma.importPayment.updateMany({
      where: { id: paymentId, status: ImportPaymentStatus.paid },
      data: { status: ImportPaymentStatus.refunding, refundReason: opts.reason, refundRequestedBy: opts.actorId, refundRequestedAt: new Date() },
    });
    if (claim.count === 0) throw new ConflictException({ message: 'A refund for this payment is already in progress.', code: 'refund_in_progress' });

    if (hasTx) {
      try {
        await this.atmos.reverseTransaction({ transactionId, reason: opts.reason, idempotencyKey: paymentId });
      } catch (e) {
        await this.prisma.importPayment.updateMany({
          where: { id: paymentId, status: ImportPaymentStatus.refunding },
          data: { status: ImportPaymentStatus.paid, needsAttention: true },
        });
        throw e;
      }
    }
    const revoked = await this.finalizeRefund(payment, {
      actorId: opts.actorId,
      action: opts.action ?? 'payment.refund',
      metadata: { reason: opts.reason, reversedAtAtmos: hasTx, atmosMode: mode, idempotencyKey: opts.idempotencyKey ?? null, userId: payment.userId, amountUzs: Math.round(payment.amountTiyins / 100) },
    });
    return { paymentId, status: ImportPaymentStatus.refunded, reversedAtAtmos: hasTx, accessRevoked: revoked, alreadyRefunded: false };
  }

  /** refunding→refunded + revoke + salesCount + AuditLog, atomically (B2/M3). Returns purchases revoked. */
  private async finalizeRefund(
    payment: { id: string; contentFormat: string },
    audit: { actorId: string | null; action: string; metadata: Prisma.InputJsonValue },
  ) {
    const contentId = catalogContentIdFromFormat(payment.contentFormat);
    return this.prisma.$transaction(async (tx) => {
      const done = await tx.importPayment.updateMany({
        where: { id: payment.id, status: ImportPaymentStatus.refunding },
        data: { status: ImportPaymentStatus.refunded },
      });
      if (done.count !== 1) throw new ConflictException({ message: 'Refund state changed concurrently.', code: 'refund_conflict' });
      let revoked = 0;
      if (contentId) {
        // M3: only the purchase this payment granted.
        revoked = (await tx.contentPurchase.updateMany({
          where: { importPaymentId: payment.id, status: PurchaseStatus.completed },
          data: { status: PurchaseStatus.refunded },
        })).count;
        if (revoked > 0) await tx.contentItem.update({ where: { id: contentId }, data: { salesCount: { decrement: revoked } } });
      }
      // Unified ledger: the unlock this payment granted (any source) is revoked with it.
      await tx.entitlement.updateMany({
        where: { importPaymentId: payment.id, status: 'active' },
        data: { status: 'revoked', revokedReason: 'refund' },
      });
      await tx.auditLog.create({
        data: { actorId: audit.actorId, action: audit.action, entityType: 'import_payment', entityId: payment.id, metadata: { ...(audit.metadata as object), accessRevoked: revoked } },
      });
      return revoked;
    });
  }

  /**
   * B2 reconciler: refunds stuck in `refunding` (process died between reverse and finalize). If Atmos shows the
   * transaction reversed/cancelled, finalize; otherwise roll back to paid and flag for support.
   */
  async reconcileStaleRefunds(olderThanMs = 10 * 60_000) {
    const stale = await this.prisma.importPayment.findMany({
      where: { status: ImportPaymentStatus.refunding, refundRequestedAt: { lt: new Date(Date.now() - olderThanMs) } },
      take: 50,
    });
    let finalized = 0;
    let rolledBack = 0;
    for (const p of stale) {
      const tx = Number(p.providerPaymentId);
      const remote = Number.isFinite(tx) && tx > 0 && this.atmos.configured() ? await this.atmos.getTransaction(tx).catch(() => null) : null;
      const reversed = !!remote && (remote.confirmed === false || /cancel|revers|refund/i.test(String(remote.statusMessage ?? '')));
      if (reversed) {
        await this.finalizeRefund(p, { actorId: p.refundRequestedBy, action: 'payment.refund.reconciled', metadata: { reason: p.refundReason, statusCode: remote?.statusCode ?? null } })
          .then(() => finalized++)
          .catch(() => undefined);
      } else {
        await this.prisma.importPayment.updateMany({ where: { id: p.id, status: ImportPaymentStatus.refunding }, data: { status: ImportPaymentStatus.paid, needsAttention: true } });
        rolledBack++;
      }
    }
    return { checked: stale.length, finalized, rolledBack };
  }

  async getPayment(userId: string, paymentId: string) {
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');

    // Fallback poll Atmos if still pending
    if (payment.status === ImportPaymentStatus.pending && payment.providerPaymentId) {
      const transactionId = Number(payment.providerPaymentId);
      const remote = await this.atmos.getTransaction(transactionId);
      
      if (remote?.confirmed) {
        await this.transitionToPaid(payment.id, { ofdUrl: remote.ofdUrl, raw: remote.raw });
        return this.prisma.importPayment.findFirstOrThrow({ where: { id: paymentId, userId } });
      }
    }

    return payment;
  }

  async markPaid(
    accountOrInvoice: string,
    opts?: { providerRef?: string; ofdUrl?: string; raw?: unknown },
  ) {
    const existing = await this.prisma.importPayment.findUnique({
      where: { account: accountOrInvoice },
    });
    if (!existing) return null;
    if (existing.status === ImportPaymentStatus.paid) return existing;
    if (existing.status !== ImportPaymentStatus.pending) return null; // B3: no resurrection

    const ok = await this.transitionToPaid(existing.id, {
      providerRef: opts?.providerRef,
      ofdUrl: opts?.ofdUrl,
      raw: opts?.raw,
    });
    if (!ok) return null;
    return this.prisma.importPayment.findUnique({ where: { id: existing.id } });
  }

  /**
   * The only way a payment becomes paid (REVIEW B3): a conditional pending→paid write. Fulfillment runs only
   * for the caller that won the transition, so webhook + poll + apply can't double-fulfill.
   */
  private async transitionToPaid(
    paymentId: string,
    opts: { providerRef?: string; ofdUrl?: string; raw?: unknown },
  ): Promise<boolean> {
    const { count } = await this.prisma.importPayment.updateMany({
      where: { id: paymentId, status: ImportPaymentStatus.pending },
      data: {
        status: ImportPaymentStatus.paid,
        paidAt: new Date(),
        ...(opts.providerRef ? { providerPaymentId: opts.providerRef } : {}),
        ...(opts.ofdUrl ? { ofdUrl: opts.ofdUrl } : {}),
        ...(opts.raw != null ? { rawCallbackJson: opts.raw as Prisma.InputJsonValue } : {}),
      },
    });
    if (count !== 1) return false;
    const paid = await this.prisma.importPayment.findUnique({ where: { id: paymentId } });
    if (paid) await this.fulfillCatalogPurchase(paid);
    await this.pricing?.redeemForPayment(paymentId).catch((e) => this.logger.error(`Promo redeem failed for ${paymentId}: ${(e as Error).message}`));
    return true;
  }

  /** Reverse a charge we must not keep; on failure, flag the row for support instead of pretending. */
  private async reverseOrFlag(paymentId: string, transactionId: number, reason: string) {
    try {
      await this.atmos.reverseTransaction({ transactionId, reason, idempotencyKey: paymentId });
    } catch (e) {
      await this.prisma.importPayment.update({ where: { id: paymentId }, data: { needsAttention: true } }).catch(() => undefined);
      this.logger.error(`Reverse failed for payment ${paymentId}: ${(e as Error).message}`);
    }
  }

  /**
   * Consume a paid (or free-credited) payment for an import. One payment → one import.
   */
  async consumePayment(userId: string, paymentId: string | undefined, importType: ImportType) {
    if (!this.gatewayEnabled()) return null;

    if (!paymentId) {
      throw new ForbiddenException('Payment required for this import. Get a quote and checkout first.');
    }

    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (catalogContentIdFromFormat(payment.contentFormat)) {
      throw new ForbiddenException('This payment is for a catalog book, not an import');
    }
    if (payment.userImportId) {
      throw new ForbiddenException('This payment was already used for an import');
    }
    if (payment.status !== ImportPaymentStatus.paid) {
      throw new ForbiddenException('Payment is not completed yet');
    }
    if (payment.importType !== importType) {
      throw new BadRequestException('Payment import type does not match');
    }
    return payment;
  }

  /**
   * After the real PDF/EPUB page count is known, refuse imports that were
   * quoted too cheaply (file-size estimates used to under-count pages).
   */
  async assertPaymentCoversPages(
    userId: string,
    payment: { id: string; amountTiyins: number; estimatedPages: number; userImportId?: string | null } | null,
    actualPages: number,
    importType: ImportType,
  ) {
    if (!this.gatewayEnabled()) return;
    if (!payment) {
      throw new ForbiddenException('Payment required for this import. Get a quote and checkout first.');
    }

    const pages = Math.max(1, Math.min(MAX_BILLABLE_PAGES, Math.floor(actualPages)));
    const needed = await this.quote(
      userId,
      { importType, contentFormat: this.mapImportTypeToFormat(importType), pageCount: pages },
      { excludePaymentId: payment.id },
    );

    const covers =
      !needed.requiresPayment ||
      (payment.amountTiyins > 0 && payment.amountTiyins >= needed.amountTiyins);

    if (!covers) {
      await this.voidUnusedPayment(payment.id);
      const remaining = needed.freeLimits.monthlyPagesRemaining;
      throw new ForbiddenException(
        `This document is ${pages} pages. You have ${remaining} free page${remaining === 1 ? '' : 's'} left, so it is not covered by the free allowance. Pay to import it.`,
      );
    }

    if (payment.estimatedPages !== pages) {
      await this.prisma.importPayment.update({
        where: { id: payment.id },
        data: { estimatedPages: pages },
      });
    }
  }

  private async voidUnusedPayment(paymentId: string) {
    const payment = await this.prisma.importPayment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.userImportId) return;
    if (payment.status === ImportPaymentStatus.paid) {
      // M2: same claim/reverse/finalize flow as an admin refund. A failed reverse leaves it paid + flagged.
      await this.refundPaidPayment(payment.id, { reason: 'Page count mismatch', actorId: null, action: 'payment.refund.auto' }).catch((e) => {
        this.logger.error(`Auto-refund failed for ${payment.id}: ${(e as Error).message}`);
        return this.prisma.importPayment.update({ where: { id: payment.id }, data: { needsAttention: true } }).catch(() => undefined);
      });
      return;
    }
    // Never overwrite a refunded/expired history (BUG-07): only pending payments become failed.
    await this.prisma.importPayment.updateMany({
      where: { id: payment.id, status: ImportPaymentStatus.pending },
      data: { status: ImportPaymentStatus.failed },
    });
  }

  async attachUserImport(paymentId: string, userImportId: string) {
    await this.prisma.importPayment.update({
      where: { id: paymentId },
      data: { userImportId },
    });
  }

  async handleAtmosCallback(body: Record<string, unknown>) {
    if (!this.atmos.validateCallbackSignature(body)) {
      return { status: 0, message: 'Invalid signature' };
    }

    const invoice = String(body.invoice ?? '');
    const amount = Number(body.amount);
    const payment = await this.prisma.importPayment.findUnique({ where: { account: invoice } });
    if (!payment) {
      return { status: 0, message: `Invoice ${invoice} is not available in the system.` };
    }
    if (payment.amountTiyins > 0 && Number.isFinite(amount) && amount !== payment.amountTiyins) {
      return { status: 0, message: 'Amount mismatch' };
    }
    if (payment.status === ImportPaymentStatus.paid) {
      return { status: 1, message: 'Successfully' };
    }
    if (payment.status !== ImportPaymentStatus.pending) {
      return { status: 0, message: `Payment status is ${payment.status}` };
    }

    await this.markPaid(invoice, {
      providerRef: String(body.transaction_id ?? payment.providerPaymentId ?? ''),
      raw: body,
    });
    return { status: 1, message: 'Successfully' };
  }

  /** Admin overview helpers */
  async revenueStats() {
    const monthStart = this.startOfUtcMonth();
    const dayStart = this.startOfUtcDay();
    const [paidMonth, paidToday, freeToday] = await Promise.all([
      this.prisma.importPayment.aggregate({
        where: { status: ImportPaymentStatus.paid, amountTiyins: { gt: 0 }, paidAt: { gte: monthStart } },
        _sum: { amountTiyins: true },
        _count: true,
      }),
      this.prisma.userImport.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.importPayment.count({
        where: { status: ImportPaymentStatus.paid, amountTiyins: 0, paidAt: { gte: dayStart } },
      }),
    ]);
    return {
      revenueFromImportsUzs: (paidMonth._sum.amountTiyins ?? 0) / 100,
      paidImportsThisMonth: paidMonth._count,
      totalImportsToday: paidToday,
      freeImportsUsedToday: freeToday,
    };
  }

  catalogPaymentsEnabled() {
    return envFlagTrue(process.env.PAYMENT_GATEWAY_ENABLED) && this.atmos.configured();
  }

  async catalogAccess(userId: string, contentId: string, isAdmin?: boolean) {
    const item = await this.prisma.contentItem.findUnique({ where: { id: contentId } });
    if (!item) throw new NotFoundException('Content not found');
    const purchasedIds = await paidCatalogIds(this.prisma, userId, [item.id]);
    const accessGranted = catalogAccessGranted({ item, userId, isAdmin, purchasedIds });
    const priceUzs = catalogPriceUzs(item);
    return {
      contentId: item.id,
      title: item.title,
      isFree: !requiresCatalogPayment(item),
      priceUzs,
      currency: 'UZS' as const,
      accessGranted,
      gatewayEnabled: this.catalogPaymentsEnabled(),
    };
  }

  async catalogCheckout(userId: string, contentId: string, isAdmin?: boolean, promoCode?: string) {
    const access = await this.catalogAccess(userId, contentId, isAdmin);
    if (access.accessGranted) {
      return {
        ...access,
        paymentId: null,
        account: null,
        transactionId: null,
        status: 'paid',
        step: 'done' as const,
      };
    }

    if (!this.catalogPaymentsEnabled()) {
      throw new ServiceUnavailableException('Payment gateway is not available for catalog purchases');
    }

    const listTiyins = Math.round(access.priceUzs * 100);
    const minTiyins = this.atmos.minAmountTiyins();
    const promo = promoCode?.trim() && this.pricing ? await this.pricing.resolvePromo(promoCode, userId, 'catalog') : null;
    const amountTiyins = listTiyins - (promo ? promoDiscountTiyins(listTiyins, promo, minTiyins) : 0);
    if (amountTiyins < minTiyins) {
      throw new BadRequestException(
        'Payment could not be processed for this book. Please try again later or contact support.',
      );
    }

    const account = `cat_${randomUUID().replace(/-/g, '')}`;
    const atmosTx = await this.atmos.createTransaction({
      account,
      amountTiyins,
    });

    const payment = await this.prisma.importPayment.create({
      data: {
        userId,
        status: ImportPaymentStatus.pending,
        importType: ImportType.url,
        contentFormat: catalogPaymentFormat(contentId),
        estimatedPages: 1,
        amountTiyins,
        listAmountTiyins: listTiyins,
        promoCodeId: promo?.id ?? null,
        account,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        providerPaymentId: String(atmosTx.transactionId),
        rawCreateJson: atmosTx.raw as Prisma.InputJsonValue,
      },
    });

    return {
      ...access,
      paymentId: payment.id,
      account: payment.account,
      transactionId: atmosTx.transactionId,
      status: payment.status,
      step: 'card' as const,
    };
  }

  /** M3: idempotent per payment (unique import_payment_id); sales count moves only when a row is created. */
  async fulfillCatalogPurchase(payment: {
    id: string;
    userId: string;
    status: ImportPaymentStatus;
    contentFormat: string;
    amountTiyins: number;
    providerPaymentId: string | null;
    provider?: string;
  }) {
    if (payment.status !== ImportPaymentStatus.paid) return;
    const contentId = catalogContentIdFromFormat(payment.contentFormat);
    if (!contentId) return;
    try {
      await this.prisma.$transaction([
        this.prisma.contentPurchase.create({
          data: {
            userId: payment.userId,
            contentId,
            amountUsd: payment.amountTiyins / 100,
            status: PurchaseStatus.completed,
            provider: payment.provider ?? 'atmos',
            providerRef: payment.providerPaymentId,
            importPaymentId: payment.id,
          },
        }),
        this.prisma.contentItem.update({ where: { id: contentId }, data: { salesCount: { increment: 1 } } }),
        this.prisma.entitlement.createMany({
          data: [{
            userId: payment.userId, kind: 'catalog_book', contentId, importPaymentId: payment.id,
            source: payment.provider === 'google_play' ? 'google_play' : 'atmos',
            sourceRef: payment.id,
          }],
          skipDuplicates: true,
        }),
      ]);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return; // already fulfilled
      throw e;
    }
  }

  fingerprintAccount(parts: string[]) {
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  }
}
