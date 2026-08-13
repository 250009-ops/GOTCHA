import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ImportPaymentStatus, ImportType, Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AtmosClient } from './atmos.client';

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
  freeLimits: {
    dailyFreeImportsPerUser: number;
    monthlyFreePageLimit: number;
    allowedFormats: string[];
    dailyFreeUsed: number;
    monthlyPagesUsed: number;
  };
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
    if (contentFormat?.trim()) return contentFormat.trim().toLowerCase();
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
      return Math.max(1, Math.min(500, Math.floor(input.pageCount)));
    }
    if (input.wordCount != null && input.wordCount > 0) {
      return Math.max(1, Math.min(500, Math.ceil(input.wordCount / WORDS_PER_PAGE)));
    }
    if (input.textLength != null && input.textLength > 0) {
      return Math.max(1, Math.min(500, Math.ceil(input.textLength / CHARS_PER_PAGE)));
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
    return { ...defaults, ...(row.value as object) } as typeof defaults;
  }

  private startOfUtcDay(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }

  private startOfUtcMonth(d = new Date()) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  }

  async freeUsage(userId: string) {
    const dayStart = this.startOfUtcDay();
    const monthStart = this.startOfUtcMonth();

    const [dailyFreeUsed, monthFreePayments] = await Promise.all([
      this.prisma.importPayment.count({
        where: {
          userId,
          status: ImportPaymentStatus.paid,
          amountTiyins: 0,
          paidAt: { gte: dayStart },
        },
      }),
      this.prisma.importPayment.findMany({
        where: {
          userId,
          status: ImportPaymentStatus.paid,
          amountTiyins: 0,
          paidAt: { gte: monthStart },
        },
        select: { estimatedPages: true },
      }),
    ]);

    const monthlyPagesUsed = monthFreePayments.reduce((sum, p) => sum + p.estimatedPages, 0);
    return { dailyFreeUsed, monthlyPagesUsed };
  }

  async findTier(pages: number) {
    const tiers = await this.prisma.importPageTier.findMany({ orderBy: { sortOrder: 'asc' } });
    return (
      tiers.find((t) => pages >= t.minPages && (t.maxPages == null || pages <= t.maxPages)) ??
      tiers[tiers.length - 1] ??
      null
    );
  }

  async quote(userId: string, input: ImportQuoteInput): Promise<ImportQuoteResult> {
    const importType = input.importType;
    const contentFormat = this.mapImportTypeToFormat(importType, input.contentFormat);
    const estimatedPages = this.estimatePages(input);
    const freeLimits = await this.getFreeLimits();
    const usage = await this.freeUsage(userId);
    const tier = await this.findTier(estimatedPages);
    const priceUzs = tier ? Number(tier.priceUsd) : 0;
    const amountTiyins = Math.max(0, Math.round(priceUzs * 100));

    const gatewayEnabled = this.gatewayEnabled();
    let isFree = !gatewayEnabled;
    let freeReason: string | null = gatewayEnabled ? null : 'Payment gateway disabled (unlimited imports)';

    if (gatewayEnabled) {
      const formatOk = freeLimits.allowedFormats.map((f) => f.toLowerCase()).includes(contentFormat);
      const underDaily = usage.dailyFreeUsed < freeLimits.dailyFreeImportsPerUser;
      const underMonthlyPages = usage.monthlyPagesUsed + estimatedPages <= freeLimits.monthlyFreePageLimit;
      if (formatOk && underDaily && underMonthlyPages) {
        isFree = true;
        freeReason = 'Within free import allowance';
      }
    }

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
      freeLimits: {
        dailyFreeImportsPerUser: freeLimits.dailyFreeImportsPerUser,
        monthlyFreePageLimit: freeLimits.monthlyFreePageLimit,
        allowedFormats: freeLimits.allowedFormats,
        dailyFreeUsed: usage.dailyFreeUsed,
        monthlyPagesUsed: usage.monthlyPagesUsed,
      },
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
      throw new BadRequestException('Unable to price this import — configure page tiers in admin');
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
    const result = await this.atmos.preApplyTransaction({
      transactionId,
      cardNumber,
      expiry,
    });

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
  ): Promise<{ paymentId: string; status: string; ofdUrl?: string; step: 'paid' | 'card' }> {
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status === ImportPaymentStatus.paid) {
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
        await this.prisma.importPayment.update({
          where: { id: payment.id },
          data: {
            status: ImportPaymentStatus.paid,
            paidAt: new Date(),
            ofdUrl: result.ofdUrl,
            rawCallbackJson: result.raw as Prisma.InputJsonValue,
          },
        });

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

    return { paymentId, status: 'pending', step: 'card' };
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
        await this.prisma.importPayment.update({
          where: { id: payment.id },
          data: {
            status: ImportPaymentStatus.paid,
            paidAt: new Date(),
            ofdUrl: remote.ofdUrl,
            rawCallbackJson: remote.raw as Prisma.InputJsonValue,
          },
        });
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

    return this.prisma.importPayment.update({
      where: { id: existing.id },
      data: {
        status: ImportPaymentStatus.paid,
        paidAt: new Date(),
        providerPaymentId: opts?.providerRef ?? existing.providerPaymentId,
        ofdUrl: opts?.ofdUrl ?? existing.ofdUrl,
        rawCallbackJson: opts?.raw != null ? (opts.raw as Prisma.InputJsonValue) : undefined,
      },
    });
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

  fingerprintAccount(parts: string[]) {
    return createHash('sha256').update(parts.join('|')).digest('hex').slice(0, 32);
  }
}
