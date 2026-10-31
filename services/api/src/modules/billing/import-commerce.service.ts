import { limitDayStart, limitMonthStart, nextLimitResetAt, nextMonthlyResetAt } from '../../common/plan-limits';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ImportPaymentStatus, ImportType, Prisma, PurchaseStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { formatIsAllowed, normalizeAllowedFormats, normalizeImportFormat } from '../../common/import-format';
import { MAX_BILLABLE_PAGES } from '../imports/pdf-page-count';
import { PrismaService } from '../../prisma/prisma.service';
import { AtmosClient, validateCardForAtmos } from './atmos.client';
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
};

export type LearnerImportAllowance = {
  gatewayEnabled: boolean;
  resetCycle: string;
  /** final-5: 00:00 Asia/Tashkent; daily imports reset at dailyResetAt, monthly pages at monthlyResetAt (1st of the month). */
  dailyResetAt: string;
  monthlyResetAt: string;
  timezone: string;
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

import { paymentsUiEnabled } from '../../common/payments-ui';
import { ForbiddenException as PaymentsForbidden } from '@nestjs/common';
export function assertPaymentsEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (!paymentsUiEnabled(env)) throw new PaymentsForbidden({ statusCode: 403, code: 'PAYMENTS_DISABLED', message: 'Paid imports are not available yet.' });
}

@Injectable()
export class ImportCommerceService {
  constructor(
    private prisma: PrismaService,
    private atmos: AtmosClient,
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
    if (resetCycle === 'daily') return limitDayStart();
    if (resetCycle === 'yearly') return this.startOfUtcYear();
    return limitMonthStart();
  }

  async freeUsage(userId: string, resetCycle = 'monthly', excludePaymentId?: string) {
    const dayStart = limitDayStart();
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
      dailyResetAt: nextLimitResetAt().toISOString(),
      monthlyResetAt: nextMonthlyResetAt().toISOString(),
      timezone: 'Asia/Tashkent',
    };
  }

  async findTier(pages: number) {
    const tiers = await this.prisma.importPageTier.findMany({
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
    let isFree = false;
    let freeReason: string | null = null;
    if (!gatewayEnabled) {
      // final-5 (b): no gateway → free, but only within the Free allowance (any format).
      const within =
        allowance.dailyFreeUsed < allowance.dailyFreeImportsPerUser &&
        allowance.monthlyPagesUsed + estimatedPages <= allowance.monthlyFreePageLimit;
      isFree = within;
      freeReason = within ? 'Within free import allowance' : 'Free import limit reached';
    }

    if (gatewayEnabled) {
      const formatOk = formatIsAllowed(allowance.allowedFormats, contentFormat);
      const underDaily = allowance.dailyFreeUsed < allowance.dailyFreeImportsPerUser;
      const underMonthlyPages = allowance.monthlyPagesUsed + estimatedPages <= allowance.monthlyFreePageLimit;
      if (formatOk && underDaily && underMonthlyPages) {
        isFree = true;
        freeReason = 'Within free import allowance';
      } else if (!paymentsUiEnabled()) {
        freeReason = 'Free import limit reached';
      } else if (!tier) {
        freeReason = 'This length is not covered by a page tier';
      }
    }

    // Minimum amount required by Atmos (configurable, default 500 soʻm)
    const minAmountTiyins = this.atmos.minAmountTiyins();
    const minAmountUzs = Math.ceil(minAmountTiyins / 100);
    const effectiveAmount = isFree ? 0 : priceUzs;
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
      amountUzs: isFree ? 0 : priceUzs,
      amountTiyins: isFree ? 0 : amountTiyins,
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
      if (!quote.isFree) {
        throw new ForbiddenException({ statusCode: 403, code: 'IMPORT_LIMIT_REACHED', message: quote.freeReason ?? 'Free import limit reached' });
      }
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

    assertPaymentsEnabled(); // final-5 B4: no paid purchase can start while PAYMENTS_UI_ENABLED is off
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
    assertPaymentsEnabled(); // final-5 B4: no paid purchase can start while PAYMENTS_UI_ENABLED is off
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
    assertPaymentsEnabled(); // final-5 B4: no paid purchase can start while PAYMENTS_UI_ENABLED is off
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === ImportPaymentStatus.paid) {
      await this.fulfillCatalogPurchase(payment); // idempotent: repairs a paid-but-not-granted catalog purchase
      return { paymentId, status: 'paid', step: 'paid' };
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
        // apply() success and STPIMS-ERR-092/093/065 "confirmed via get" both land here → same settlement as callback/poll.
        await this.settlePaid(payment.id, { ofdUrl: result.ofdUrl, raw: result.raw });

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
    assertPaymentsEnabled(); // final-5 B4: no paid purchase can start while PAYMENTS_UI_ENABLED is off
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
   * Cancel a pending payment or refund a paid payment.
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
    
    if (payment.status === ImportPaymentStatus.paid && payment.providerPaymentId) {
      // Refund confirmed payment
      const transactionId = Number(payment.providerPaymentId);
      await this.atmos.reverseTransaction({ transactionId, reason });
      await this.prisma.importPayment.update({
        where: { id: payment.id },
        data: { status: ImportPaymentStatus.refunded },
      });
      return { paymentId, status: 'refunded' };
    }

    // Cancel pending payment
    await this.prisma.importPayment.update({
      where: { id: payment.id },
      data: { status: ImportPaymentStatus.failed },
    });

    return { paymentId, status: 'cancelled' };
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
        await this.settlePaid(payment.id, { ofdUrl: remote.ofdUrl, raw: remote.raw });
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
    return this.settlePaid(existing.id, { providerRef: opts?.providerRef, ofdUrl: opts?.ofdUrl, raw: opts?.raw });
  }

  /**
   * final-5: the ONE paid transition for every confirmation path (apply, apply→"confirmed via get", getPayment poll,
   * Atmos callback). Idempotent: only a non-paid row flips to paid (conditional update, so concurrent paths cannot
   * double-settle) and the catalog grant is re-checked on every call, so a paid-but-not-granted purchase is repaired.
   * Import payments stay paid + unused (userImportId null) until consumePayment attaches exactly one import.
   */
  async settlePaid(paymentId: string, opts?: { providerRef?: string; ofdUrl?: string; raw?: unknown }) {
    await this.prisma.importPayment.updateMany({
      where: { id: paymentId, status: { not: ImportPaymentStatus.paid } },
      data: {
        status: ImportPaymentStatus.paid,
        paidAt: new Date(),
        ...(opts?.providerRef ? { providerPaymentId: opts.providerRef } : {}),
        ...(opts?.ofdUrl ? { ofdUrl: opts.ofdUrl } : {}),
        ...(opts?.raw != null ? { rawCallbackJson: opts.raw as Prisma.InputJsonValue } : {}),
      },
    });
    const row = await this.prisma.importPayment.findUnique({ where: { id: paymentId } });
    if (row) await this.fulfillCatalogPurchase(row);
    return row;
  }

  /** final-5 (f29902f1): paid import payments not yet attached to an import, so the learner can finish that import. */
  unusedPaidImports(userId: string) {
    return this.prisma.importPayment.findMany({
      where: { userId, status: ImportPaymentStatus.paid, userImportId: null, amountTiyins: { gt: 0 }, NOT: { contentFormat: { startsWith: 'catalog:' } } },
      orderBy: { paidAt: 'desc' },
      select: { id: true, importType: true, estimatedPages: true, amountTiyins: true, paidAt: true },
    });
  }

  /**
   * Consume a paid (or free-credited) payment for an import. One payment → one import.
   */
  async consumePayment(userId: string, paymentId: string | undefined, importType: ImportType, pages?: number) {
    // final-5 (b): with the gateway off, imports are free but the Free allowance (3 a day / 50 pages a month) is still enforced.
    if (!this.gatewayEnabled()) {
      if (paymentId) {
        const pre = await this.prisma.importPayment.findFirst({
          where: { id: paymentId, userId, status: ImportPaymentStatus.paid, userImportId: null, importType },
        });
        if (pre && !catalogContentIdFromFormat(pre.contentFormat)) return pre; // credit already taken at checkout
      }
      return this.grantFreeImportCredit(userId, importType, pages ?? 1);
    }

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

  /** final-5 (b): gateway-off free import credit. Same counters as the gateway free path (amount 0 paid rows). */
  async grantFreeImportCredit(userId: string, importType: ImportType, pages: number) {
    const estimatedPages = Math.max(1, Math.min(MAX_BILLABLE_PAGES, Math.floor(pages) || 1));
    const allowance = await this.learnerAllowance(userId);
    const devUnlimited = envFlagTrue(process.env.DEV_UNLIMITED_IMPORTS) && process.env.NODE_ENV !== 'production';
    const overDaily = !devUnlimited && allowance.dailyFreeUsed >= allowance.dailyFreeImportsPerUser;
    const overPages = !devUnlimited && allowance.monthlyPagesUsed + estimatedPages > allowance.monthlyFreePageLimit;
    if (overDaily || overPages) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'IMPORT_LIMIT_REACHED',
        message: overDaily
          ? `Free import limit reached: ${allowance.dailyFreeImportsPerUser} imports a day.`
          : `Free import limit reached: ${allowance.monthlyFreePageLimit} pages a month (${allowance.monthlyPagesRemaining} left).`,
        limit: overDaily ? 'daily_imports' : 'monthly_pages',
        dailyFreeImportsPerUser: allowance.dailyFreeImportsPerUser,
        monthlyFreePageLimit: allowance.monthlyFreePageLimit,
        monthlyPagesRemaining: allowance.monthlyPagesRemaining,
        resetAt: overDaily ? allowance.dailyResetAt : allowance.monthlyResetAt,
        timezone: 'Asia/Tashkent',
      });
    }
    return this.prisma.importPayment.create({
      data: {
        userId,
        status: ImportPaymentStatus.paid,
        importType,
        contentFormat: this.mapImportTypeToFormat(importType),
        estimatedPages,
        amountTiyins: 0,
        account: `free_${randomUUID().replace(/-/g, '')}`,
        paidAt: new Date(),
      },
    });
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
    if (payment.status === ImportPaymentStatus.paid && payment.providerPaymentId) {
      const transactionId = Number(payment.providerPaymentId);
      if (Number.isFinite(transactionId) && transactionId > 0) {
        await this.atmos.reverseTransaction({ transactionId, reason: 'Page count mismatch' }).catch(() => undefined);
      }
      await this.prisma.importPayment.update({
        where: { id: payment.id },
        data: { status: ImportPaymentStatus.refunded },
      });
      return;
    }
    await this.prisma.importPayment.update({
      where: { id: payment.id },
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
      await this.settlePaid(payment.id); // idempotent re-check of the catalog grant
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
    const monthStart = limitMonthStart();
    const dayStart = limitDayStart();
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

  async catalogCheckout(userId: string, contentId: string, isAdmin?: boolean) {
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

    assertPaymentsEnabled(); // final-5 B4: no paid purchase can start while PAYMENTS_UI_ENABLED is off
    if (!this.catalogPaymentsEnabled()) {
      throw new ServiceUnavailableException('Payment gateway is not available for catalog purchases');
    }

    const amountTiyins = Math.round(access.priceUzs * 100);
    const minTiyins = this.atmos.minAmountTiyins();
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

  private async fulfillCatalogPurchase(payment: {
    userId: string;
    status: ImportPaymentStatus;
    contentFormat: string;
    amountTiyins: number;
    providerPaymentId: string | null;
  }) {
    if (payment.status !== ImportPaymentStatus.paid) return;
    const contentId = catalogContentIdFromFormat(payment.contentFormat);
    if (!contentId) return;

    const existing = await this.prisma.contentPurchase.findFirst({
      where: { userId: payment.userId, contentId, status: PurchaseStatus.completed },
      select: { id: true },
    });
    if (existing) return;

    await this.prisma.$transaction([
      this.prisma.contentPurchase.create({
        data: {
          userId: payment.userId,
          contentId,
          amountUsd: payment.amountTiyins / 100,
          status: PurchaseStatus.completed,
          provider: 'atmos',
          providerRef: payment.providerPaymentId,
        },
      }),
      this.prisma.contentItem.update({
        where: { id: contentId },
        data: { salesCount: { increment: 1 } },
      }),
    ]);
  }

  fingerprintAccount(parts: string[]) {
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  }
}
