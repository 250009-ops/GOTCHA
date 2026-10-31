import { limitDayStart, limitMonthStart, nextLimitResetAt, nextMonthlyResetAt } from '../../common/plan-limits';
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
  GoneException,
} from '@nestjs/common';
import { ImportPaymentStatus, ImportType, Prisma, PurchaseStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { formatIsAllowed, normalizeAllowedFormats, normalizeImportFormat } from '../../common/import-format';
import { MAX_BILLABLE_PAGES } from '../imports/pdf-page-count';
import { PrismaService } from '../../prisma/prisma.service';
import { AtmosClient, validateCardForAtmos } from './atmos.client';
import { isSellableTier } from './page-tiers';
import { capTotalDiscountTiyins, OFERTA_VERSION, PLUS_ACCOUNT_PREFIX, PLUS_SETTING_KEYS, dueReminder, plusDiscountTiyins, plusPassConfig, plusPassDaysFromFormat, plusPassExpiry, plusPassFormat, type PlusPassDays } from './plus-pass';
import { projectPlus } from './entitlements.service';
import { getPlanCaps, userCapPlan } from '../../common/plan-caps';
import { AI_SETTING_KEYS, coerceNonNegInt, defaultAiPlatformSettings, resolveLearnerDailyAiQuota } from '../ai/ai-settings';
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
import { TASHKENT_OFFSET_MS } from '../../common/tashkent-window';
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
  plusApplied?: boolean;
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
  /** WLF-15: which import pool applies ('plus' = active Plus entitlement; caps from importFreeLimits.plus*). */
  tier?: 'free' | 'plus';
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
  /** true when an open pending payment was reused (double-submit guard). */
  reused?: boolean;
};

/** A paid import may fail this many times and be retried free on the same payment before it becomes refund-due. */
export const MAX_FREE_IMPORT_RETRIES = 2;

/** PAY2-01: unverified stale pending payments are only expired after this long past expiresAt (flagged). */
export const EXPIRY_UNVERIFIED_CAP_MS = 24 * 3_600_000;
const EXPIRY_BACKOFF_BASE_MS = 10 * 60_000;
const EXPIRY_BACKOFF_MAX_MS = 2 * 3_600_000;

/** PAY2-08: marker (cancelReason) for an import payment paid on the late/reconcile path with no import run. */
export const LATE_UNATTACHED = 'paid_late_no_import';
/** PAY2-08: unused late-paid imports become refund-due after 7 days. */
export const LATE_UNATTACHED_REFUND_MS = 7 * 24 * 3600_000;

/** PAY2-23: needsAttention is only the manual-review flag (payment_under_review / 24 h expired_unverified), not a refund-due
 * or failed-reverse flag, so a definitive Atmos answer may clear it. */
export function reviewFlagOnly(p: { status: string; cancelReason: string | null; refundDue?: boolean | null }): boolean {
  if (p.refundDue) return false;
  if (p.status === 'pending') return p.cancelReason == null;
  return p.status === 'expired' && (p.cancelReason ?? '').startsWith('expired_unverified');
}
import { paymentsUiEnabled } from '../../common/payments-ui';
import { ForbiddenException as PaymentsForbidden } from '@nestjs/common';
export function assertPaymentsEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (!paymentsUiEnabled(env)) throw new PaymentsForbidden({ statusCode: 403, code: 'PAYMENTS_DISABLED', message: 'Paid imports are not available yet.' });
}

@Injectable()
export class ImportCommerceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportCommerceService.name);
  private reconcileTimer?: NodeJS.Timeout;
  private expiryTimer?: NodeJS.Timeout;

  onModuleInit() {
    const mode = this.atmos.mode();
    if (this.gatewayEnabled() && mode === null) {
      this.logger.warn('ATMOS_SANDBOX is unset while payments are enabled: local-only refunds are refused (set it explicitly).');
    } else {
      this.logger.log(`Atmos mode: ${mode ?? 'unset'}`);
    }
    if (process.env.NODE_ENV !== 'test') {
      this.reconcileTimer = setInterval(() => {
        void this.reconcileStaleRefunds().catch(() => undefined);
        void this.expireStalePending().catch(() => undefined); // PAY1-08
        void this.sendPlusReminders().catch(() => undefined);
      }, 10 * 60_000);
      this.expiryTimer = setInterval(() => void this.expirePasses().catch(() => undefined), 24 * 3_600_000);
      this.expiryTimer.unref?.();
      setTimeout(() => void this.expirePasses().catch(() => undefined), 60_000).unref?.();
      this.reconcileTimer.unref?.();
    }
  }

  onModuleDestroy() {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    if (this.expiryTimer) clearInterval(this.expiryTimer);
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
      // WLF-15: Plus import pool (admin Import & Pricing → importFreeLimits). Unset = same numbers as Free (PM to set).
      plusDailyImportsPerUser: null as number | null,
      plusMonthlyPageLimit: null as number | null,
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

  // All limit windows reset at 00:00 Asia/Tashkent: daily at midnight, monthly pages at midnight on the 1st, yearly on 1 Jan.
  // Tashkent is UTC+5 all year (no DST).
  private startOfTashkentDay(d = new Date()) {
    const t = new Date(d.getTime() + TASHKENT_OFFSET_MS);
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) - TASHKENT_OFFSET_MS);
  }

  private startOfTashkentMonth(d = new Date()) {
    const t = new Date(d.getTime() + TASHKENT_OFFSET_MS);
    return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1) - TASHKENT_OFFSET_MS);
  }

  private startOfTashkentYear(d = new Date()) {
    const t = new Date(d.getTime() + TASHKENT_OFFSET_MS);
    return new Date(Date.UTC(t.getUTCFullYear(), 0, 1) - TASHKENT_OFFSET_MS);
  }

  private pageWindowStart(resetCycle: string) {
    if (resetCycle === 'daily') return this.startOfTashkentDay();
    if (resetCycle === 'yearly') return this.startOfTashkentYear();
    return this.startOfTashkentMonth();
  }

  async freeUsage(userId: string, resetCycle = 'monthly', excludePaymentId?: string) {
    const dayStart = this.startOfTashkentDay();
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
    // WLF-15: an active Plus user gets the Plus import pool, never the Free one.
    const isPlus =
      (await userCapPlan(this.prisma, userId).catch(() => 'free')) === 'plus' ||
      (await this.plusBenefitsFor(userId).then(Boolean, () => false));
    const capOf = (plusV: unknown, freeV: unknown) =>
      Math.max(0, Math.floor(Number(isPlus && plusV != null && plusV !== '' ? plusV : freeV) || 0));
    const dailyCap = capOf(freeLimits.plusDailyImportsPerUser, freeLimits.dailyFreeImportsPerUser);
    const pageCap = capOf(freeLimits.plusMonthlyPageLimit, freeLimits.monthlyFreePageLimit);
    return {
      tier: isPlus ? 'plus' : 'free',
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
    const matched = await this.findTier(estimatedPages);
    // A matched tier priced 0 / below the Atmos minimum is "not priced", never "free" (live 901–1500 = 0 soʻm bug).
    const tier = matched && isSellableTier({ priceUzs: Number(matched.priceUsd) }, Math.ceil(this.atmos.minAmountTiyins() / 100)) ? matched : null;
    const priceUzs = tier ? Number(tier.priceUsd) : 0;
    const amountTiyins = Math.max(0, Math.round(priceUzs * 100));

    const gatewayEnabled = allowance.gatewayEnabled;
    const plus = gatewayEnabled ? await this.plusBenefitsFor(userId) : null;
    let isFree = false;
    let freeReason: string | null = null;
    if (!gatewayEnabled) {
      // final-5 (b): no gateway → free, but only within the Free allowance (any format).
      const within =
        allowance.dailyFreeUsed < allowance.dailyFreeImportsPerUser &&
        allowance.monthlyPagesUsed + estimatedPages <= allowance.monthlyFreePageLimit;
      isFree = within;
      freeReason = within ? 'Within free import allowance' : allowance.tier === 'plus' ? 'Import limit reached' : 'Free import limit reached';
    }

    if (gatewayEnabled) {
      const formatOk = formatIsAllowed(allowance.allowedFormats, contentFormat);
      const underDaily = allowance.dailyFreeUsed < allowance.dailyFreeImportsPerUser;
      const underMonthlyPages = allowance.monthlyPagesUsed + estimatedPages <= allowance.monthlyFreePageLimit;
      if (formatOk && underDaily && underMonthlyPages) {
        isFree = true;
        freeReason = 'Within free import allowance';
      } else if (formatOk && plus && plus.benefits.freeImportMaxPages >= estimatedPages) {
        isFree = true;
        freeReason = 'Included with Plus';
      } else if (!paymentsUiEnabled()) {
        freeReason = 'Free import limit reached';
      } else if (!tier) {
        freeReason = matched ? 'This length is not priced yet' : 'This length is not covered by a page tier';
      }
    }

    // Minimum amount required by Atmos (configurable, default 500 soʻm)
    const minAmountTiyins = this.atmos.minAmountTiyins();
    const minAmountUzs = Math.ceil(minAmountTiyins / 100);
    // Promo (admin-managed): only on a payable quote; capped at 70% and never below the Atmos minimum.
    let promo: { id: string; code: string } | null = null;
    let discountTiyins = 0;
    // Plan-aware: an active Plus pass takes its configured % off first (never below the Atmos minimum).
    const plusDiscount = !isFree && plus ? plusDiscountTiyins(amountTiyins, plus.benefits.importDiscountPct, minAmountTiyins) : 0;
    discountTiyins = plusDiscount;
    if (input.promoCode?.trim() && !isFree && gatewayEnabled && amountTiyins > 0 && this.pricing) {
      const p = await this.pricing.resolvePromo(input.promoCode, userId, 'imports');
      discountTiyins = plusDiscount + promoDiscountTiyins(amountTiyins - plusDiscount, p, minAmountTiyins);
      promo = { id: p.id, code: p.code };
      // PRICING rule 6: Plus + promo combined never exceeds 70 % of the list price.
      discountTiyins = capTotalDiscountTiyins(amountTiyins, discountTiyins, minAmountTiyins);
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
      plusApplied: Boolean(plus) && (plusDiscount > 0 || freeReason === 'Included with Plus'),
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

    const reusable = await this.findReusablePending(userId, quote);
    if (reusable) {
      return {
        quote,
        paymentId: reusable.id,
        account: reusable.account,
        transactionId: Number(reusable.providerPaymentId),
        status: reusable.status,
        isFree: false,
        step: 'card',
        reused: true,
      };
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
        rawCreateJson: redactAtmosRaw(atmosTx.raw) as Prisma.InputJsonValue,
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
   * PAYMENTS P2 + PAY2-21: a pending payment past `expiresAt` (60 min) is never expired blind on a learner retry.
   * - No Atmos transaction yet → nothing can have been charged → expired (`session_expired`).
   * - Ask Atmos: confirmed → paid via markPaid(late) (fulfils once) → `payment_completed`.
   * - Definitive non-paid answer (store_transaction, confirmed=false) → expired (`session_expired`).
   * - Atmos unreachable / no definitive answer → stays PENDING with needsAttention=true (manual review; the
   *   expiry sweep keeps reconciling) → `payment_under_review`. Never sent to Atmos for a new charge.
   */
  async assertNotExpired(payment: { id: string; status: ImportPaymentStatus; expiresAt: Date | null; providerPaymentId?: string | null; account?: string | null }, now = new Date()) {
    if (!(payment.status === ImportPaymentStatus.pending && payment.expiresAt && payment.expiresAt.getTime() <= now.getTime())) return;
    const gone = () => new GoneException({ message: 'This payment session has expired. Go back and start checkout again.', code: 'session_expired' });
    const expire = () => this.prisma.importPayment.updateMany({ where: { id: payment.id, status: ImportPaymentStatus.pending }, data: { status: ImportPaymentStatus.expired, nextCheckAt: null } });
    const tx = Number(payment.providerPaymentId);
    if (!(Number.isFinite(tx) && tx > 0)) { await expire(); throw gone(); }
    let remote: Awaited<ReturnType<AtmosClient['getTransaction']>> | null = null;
    let failed = !this.atmos.configured();
    if (!failed) {
      try { remote = await this.atmos.getTransaction(tx); } catch (e) { failed = true; this.logger.warn(`retry-after-expiry ${payment.id}: Atmos error ${(e as Error).message}`); }
    }
    if (remote?.confirmed && payment.account) {
      await this.markPaid(payment.account, { ofdUrl: remote.ofdUrl, raw: remote.raw, late: true });
      throw new BadRequestException({ message: 'Payment is already completed', code: 'payment_completed' });
    }
    const definitive = !failed && remote != null && !remote.confirmed && (remote.raw as { store_transaction?: unknown } | null)?.store_transaction != null;
    if (definitive) { await expire(); throw gone(); }
    await this.prisma.importPayment.updateMany({ where: { id: payment.id, status: ImportPaymentStatus.pending }, data: { needsAttention: true } });
    this.logger.warn(`payment ${payment.id}: learner retry after expiry, Atmos status unknown → flagged for manual review`);
    throw new ConflictException({ message: 'We are checking this payment with the bank. You will not be charged twice. Please contact support if this does not resolve.', code: 'payment_under_review' });
  }

  /** Card/OTP steps only run on a pending, unexpired payment (preApply previously accepted failed/expired rows). */
  async assertPayable(payment: { id: string; status: ImportPaymentStatus; expiresAt: Date | null }) {
    if (payment.status === ImportPaymentStatus.paid) {
      throw new BadRequestException({ message: 'Payment is already completed', code: 'payment_completed' });
    }
    if (payment.status !== ImportPaymentStatus.pending) {
      throw new ConflictException({ message: `Payment is ${payment.status}.`, code: 'payment_not_pending' });
    }
    await this.assertNotExpired(payment);
  }

  /**
   * PAYMENTS P1 double-submit guard: a second checkout for the same import within the session window
   * reuses the open pending payment instead of creating a second Atmos transaction.
   */
  async findReusablePending(userId: string, q: { importType: ImportType; estimatedPages: number; amountTiyins: number }, now = new Date()) {
    return this.prisma.importPayment.findFirst({
      where: {
        userId,
        status: ImportPaymentStatus.pending,
        importType: q.importType,
        estimatedPages: q.estimatedPages,
        amountTiyins: q.amountTiyins,
        account: { startsWith: 'imp_' },
        providerPaymentId: { not: null },
        expiresAt: { gt: new Date(now.getTime() + 5 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
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
    await this.assertPayable(payment);
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
    // REVIEW B3: never charge a cancelled/failed/expired/refunded payment.
    if (payment.status !== ImportPaymentStatus.pending) {
      throw new ConflictException({ message: `Payment is ${payment.status}.`, code: 'payment_not_pending' });
    }
    await this.assertNotExpired(payment);
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
          // PAY1-01: lost the pending→paid race. Re-read the status under a row lock and act on THAT:
          // the webhook/poll may already have paid + delivered it → never reverse a delivered payment.
          const now = await this.lockedPaymentStatus(payment.id);
          if (now === ImportPaymentStatus.paid || now === ImportPaymentStatus.refunding || now === ImportPaymentStatus.refunded) {
            return { paymentId, status: 'paid', ofdUrl: result.ofdUrl, step: 'paid' };
          }
          if (now === ImportPaymentStatus.expired && await this.transitionToPaid(payment.id, { ofdUrl: result.ofdUrl, raw: result.raw }, [ImportPaymentStatus.expired])) {
            // PAY2-01: the session expired while the OTP was in flight but Atmos charged → deliver, never strand the money.
            return { paymentId, status: 'paid', ofdUrl: result.ofdUrl, step: 'paid' };
          }
          if (now === ImportPaymentStatus.failed || now === ImportPaymentStatus.expired) {
            // Cancelled/expired while the OTP was in flight: the card was charged but nothing was delivered.
            await this.reverseOrFlag(payment.id, transactionId, 'Payment was cancelled before confirmation');
            throw new ConflictException({ message: 'This payment was cancelled; the charge is being reversed.', code: 'payment_not_pending' });
          }
          return { paymentId, status: 'pending', step: 'otp' };
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
    assertPaymentsEnabled(); // final-5 B4: no paid purchase can start while PAYMENTS_UI_ENABLED is off
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    await this.assertPayable(payment);
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
  ): Promise<{ paymentId: string; status: 'cancelled' | 'reversing'; needsAttention?: boolean }> {
    const payment = await this.prisma.importPayment.findFirst({
      where: { id: paymentId, userId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    // Decision (13:43 UTC+5): a PAID payment is never self-serve reversed; 409 refund_requires_support stays.
    // Automatic reversal only covers the races (cancel while OTP in flight / Atmos already confirmed).
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
      // Race case → screen 06b ("refund on the way"); a failed reverse is flagged and points to support.
      if (remote?.confirmed) {
        const ok = await this.reverseOrFlag(payment.id, tx, 'Cancelled by learner');
        return { paymentId, status: 'reversing', needsAttention: !ok };
      }
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
        await this.atmos.reverseTransaction({ transactionId: await this.reverseIdFor(transactionId), reason: opts.reason, idempotencyKey: paymentId });
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
    await projectPlus(this.prisma, payment.userId).catch(() => undefined); // a refund ends Plus immediately
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
      // PAY1-02: a refunded Plus pass gives back its unused days, so passes stacked after it move earlier.
      await shiftStackedPlusAfterRefund(tx, payment.id, new Date());
      // Unified ledger: the unlock this payment granted (any source) is revoked with it.
      await tx.entitlement.updateMany({
        where: { importPaymentId: payment.id, status: 'active' },
        data: { status: 'revoked', revokedReason: 'refund', expiresAt: new Date() },
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

  /**
   * Learner payment history (web "Payments" screen). Read-only, DB only — never calls Atmos.
   * Safe projection: no raw provider JSON, no provider ids, no card data.
   */
  async listPayments(userId: string, opts?: { limit?: number; cursor?: string }) {
    const take = Math.min(50, Math.max(1, Math.floor(Number(opts?.limit) || 20)));
    const rows = await this.prisma.importPayment.findMany({
      where: { userId, amountTiyins: { gt: 0 } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: take + 1,
      ...(opts?.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const page = rows.slice(0, take);
    return {
      items: page.map((p) => toPaymentSummary(p)),
      nextCursor: rows.length > take ? page[page.length - 1]?.id ?? null : null,
    };
  }

  /**
   * GET /billing/payments: Atmos payments (imports + books, amount > 0) and Google Play purchases, newest first.
   * Cursor = ISO createdAt of the last item. Never calls Atmos/Play.
   */
  async listAllPayments(userId: string, opts?: { limit?: number; before?: string }) {
    const take = Math.min(50, Math.max(1, Math.floor(Number(opts?.limit) || 20)));
    const before = opts?.before && !Number.isNaN(Date.parse(opts.before)) ? new Date(opts.before) : undefined;
    const createdAt = before ? { lt: before } : undefined;
    const [atmos, play, grants] = await Promise.all([
      this.prisma.importPayment.findMany({
        where: { userId, amountTiyins: { gt: 0 }, ...(createdAt ? { createdAt } : {}) },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
      }),
      this.prisma.playPurchase.findMany({
        where: { userId, ...(createdAt ? { createdAt } : {}) },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
      }),
      this.prisma.entitlement.findMany({
        where: { userId, source: 'admin', ...(createdAt ? { createdAt } : {}) },
        orderBy: { createdAt: 'desc' },
        take: take + 1,
      }),
    ]);
    const grantRows: PaymentSummary[] = grants.map((g) => ({
      id: g.id, kind: 'admin_grant', source: 'admin', needsAttention: false, contentId: g.contentId ?? null,
      status: g.status, amountUzs: 0, currency: 'UZS', estimatedPages: 0, contentFormat: g.kind,
      createdAt: g.createdAt.toISOString(), paidAt: null, receiptUrl: null, plusDays: null,
      endsAt: g.expiresAt ? g.expiresAt.toISOString() : null, ownReceiptPath: null,
    }));
    const merged = [...atmos.map(toPaymentSummary), ...play.map(toPlaySummary), ...grantRows].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const items = merged.slice(0, take);
    return { items, nextCursor: merged.length > take ? items[items.length - 1].createdAt : null };
  }

  /** Our own receipt for a paid/refunded Atmos payment: only the learner's own price, no raw provider JSON. */
  async paymentReceipt(userId: string, paymentId: string) {
    const p = await this.prisma.importPayment.findFirst({ where: { id: paymentId, userId } });
    if (!p || (p.status !== ImportPaymentStatus.paid && p.status !== ImportPaymentStatus.refunded)) {
      throw new NotFoundException({ message: 'Receipt not found', code: 'payment_not_found' });
    }
    const s = toPaymentSummary(p);
    return {
      receiptNo: `G-${p.id.slice(0, 8).toUpperCase()}`,
      // Sarvarbek 13:57 ('I accept the risk'): seller is the team only; no legal name / STIR fields.
      seller: SELLER.en,
      sellerI18n: SELLER,
      ofertaUrl: OFERTA_URL,
      item: s.kind, plusDays: s.plusDays ?? null, estimatedPages: s.kind === 'import' ? s.estimatedPages : null, contentId: s.contentId,
      amountUzs: s.amountUzs, currency: 'UZS', paidAt: s.paidAt, status: s.status,
      paymentMethod: 'Atmos (card)', fiscalReceiptUrl: s.receiptUrl,
      refundPolicy: REFUND_RULE_EN,
    };
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
        return stripProviderRaw(await this.prisma.importPayment.findFirstOrThrow({ where: { id: paymentId, userId } }));
      }
    }

    return stripProviderRaw(payment);
  }

  async markPaid(
    accountOrInvoice: string,
    opts?: { providerRef?: string; ofdUrl?: string; raw?: unknown; late?: boolean },
  ) {
    const existing = await this.prisma.importPayment.findUnique({
      where: { account: accountOrInvoice },
    });
    if (!existing) return null;
    if (existing.status === ImportPaymentStatus.paid) {
      await this.fulfillCatalogPurchase(existing); // final-5 (8a26b7f3): a later confirmation repairs a paid-but-not-granted catalog purchase (idempotent)
      return existing;
    }
    // B3: no resurrection of failed (learner-cancelled) / refunding / refunded rows. PAY2-01: an EXPIRED session that
    // Atmos confirms late (callback / status check) was really charged → deliver it (idempotent, conditional write).
    if (existing.status !== ImportPaymentStatus.pending && existing.status !== ImportPaymentStatus.expired) return null;

    // PAY2-12: the 24 h "expired unverified" manual-review flag is resolved by the late grant itself.
    // Cleared BEFORE the transition so a Plus-grant failure inside it can still re-flag the row.
    // PAY2-23: the same holds for the payment_under_review flag (Atmos unreachable on a retry: pending, needsAttention, no
    // cancelReason); the confirmed grant resolves it. Other flags (refund due, failed reverse) carry their own state and stay.
    if (existing.needsAttention && reviewFlagOnly(existing)) {
      await this.prisma.importPayment.updateMany({ where: { id: existing.id, status: existing.status }, data: { needsAttention: false, cancelReason: null, nextCheckAt: null } });
    }
    const ok = await this.transitionToPaid(existing.id, {
      providerRef: opts?.providerRef,
      ofdUrl: opts?.ofdUrl,
      raw: opts?.raw,
    }, [ImportPaymentStatus.pending, ImportPaymentStatus.expired]);
    if (!ok) return null;
    // PAY2-08: a late success (expired → paid, via callback or the expiry reconcile) can't have run the
    // import: the learner's return page gave up. Never leave it as a silent charge.
    const sessionOver = existing.expiresAt != null && existing.expiresAt.getTime() <= Date.now();
    if (existing.status === ImportPaymentStatus.expired || sessionOver || opts?.late) await this.flagLateUnattachedImport(existing.id);
    return this.prisma.importPayment.findUnique({ where: { id: existing.id } });
  }

  /**
   * PAY2-08: import payment that ended paid on the late / reconcile path with no import attached →
   * needsAttention + reason LATE_UNATTACHED. The learner sees it on the Import page as a free retry on the
   * SAME payment (importRetryState.freeRetries, no new charge); if unused for LATE_UNATTACHED_REFUND_MS it
   * becomes refund-due for admin review (settleFailedImports). Plus / catalog payments are not imports.
   */
  private async flagLateUnattachedImport(paymentId: string) {
    const p = await this.prisma.importPayment.findUnique({ where: { id: paymentId } });
    if (!p || p.status !== ImportPaymentStatus.paid || p.userImportId) return;
    if (plusPassDaysFromFormat(p.contentFormat) || catalogContentIdFromFormat(p.contentFormat)) return;
    await this.prisma.importPayment.updateMany({
      where: { id: paymentId, status: ImportPaymentStatus.paid, userImportId: null },
      data: { needsAttention: true, cancelReason: LATE_UNATTACHED },
    });
    this.logger.warn(`payment ${paymentId}: paid late with no import attached → offered as free retry, flagged for review`);
  }

  /**
   * The only way a payment becomes paid (REVIEW B3): a conditional pending→paid write. Fulfillment runs only
   * for the caller that won the transition, so webhook + poll + apply can't double-fulfill.
   */
  private async transitionToPaid(
    paymentId: string,
    opts: { providerRef?: string; ofdUrl?: string; raw?: unknown },
    from: ImportPaymentStatus[] = [ImportPaymentStatus.pending],
  ): Promise<boolean> {
    const { count } = await this.prisma.importPayment.updateMany({
      where: { id: paymentId, status: from.length === 1 ? from[0] : { in: from } },
      data: {
        status: ImportPaymentStatus.paid,
        paidAt: new Date(),
        ...(opts.ofdUrl ? { ofdUrl: opts.ofdUrl } : {}),
        ...(opts.raw != null ? { rawCallbackJson: redactAtmosRaw(opts.raw) as Prisma.InputJsonValue } : {}),
      },
    });
    if (count !== 1) return false;
    const paid = await this.prisma.importPayment.findUnique({ where: { id: paymentId } });
    if (paid) await this.fulfillCatalogPurchase(paid);
    if (paid) await this.fulfillPlusPass(paid).catch((e) => {
      this.logger.error(`Plus grant failed for ${paymentId}: ${(e as Error).message}`);
      return this.prisma.importPayment.update({ where: { id: paymentId }, data: { needsAttention: true } }).catch(() => undefined);
    });
    await this.pricing?.redeemForPayment(paymentId).catch((e) => this.logger.error(`Promo redeem failed for ${paymentId}: ${(e as Error).message}`));
    return true;
  }

  /**
   * final-5: the ONE paid transition for every confirmation path (apply, apply→"confirmed via get", getPayment poll,
   * Atmos callback). Idempotent: only a non-paid row flips to paid (conditional update, so concurrent paths cannot
   * double-settle) and the catalog grant is re-checked on every call, so a paid-but-not-granted purchase is repaired.
   * Import payments stay paid + unused (userImportId null) until consumePayment attaches exactly one import.
   */
  async settlePaid(paymentId: string, opts?: { providerRef?: string; ofdUrl?: string; raw?: unknown }) {
    // r3b merge: delegates to the payments-02 conditional transition (pending/expired → paid, Plus + catalog fulfilment).
    const row = await this.prisma.importPayment.findUnique({ where: { id: paymentId } });
    if (!row) return null;
    if (row.status === ImportPaymentStatus.pending || row.status === ImportPaymentStatus.expired) await this.transitionToPaid(paymentId, opts ?? {}, [ImportPaymentStatus.pending, ImportPaymentStatus.expired]);
    else if (row.status === ImportPaymentStatus.paid) await this.fulfillCatalogPurchase(row);
    return this.prisma.importPayment.findUnique({ where: { id: paymentId } });
  }

  /** final-5 (f29902f1): paid import payments not yet attached to an import, so the learner can finish that import. */
  unusedPaidImports(userId: string) {
    return this.prisma.importPayment.findMany({
      where: { userId, status: ImportPaymentStatus.paid, userImportId: null, amountTiyins: { gt: 0 }, NOT: { contentFormat: { startsWith: 'catalog:' } } },
      orderBy: { paidAt: 'desc' },
      select: { id: true, importType: true, estimatedPages: true, amountTiyins: true, paidAt: true },
    });
  }

  /** PAY1-01: current status read under `SELECT … FOR UPDATE` (serialises with a concurrent webhook/cancel). */
  private async lockedPaymentStatus(paymentId: string): Promise<ImportPaymentStatus | null> {
    return this.prisma.$transaction(async (tx) => {
      if (typeof (tx as { $queryRaw?: unknown }).$queryRaw === 'function') {
        const rows = await tx.$queryRaw<Array<{ status: ImportPaymentStatus }>>`SELECT status::text AS status FROM import_payments WHERE id = ${paymentId}::uuid FOR UPDATE`;
        return rows[0]?.status ?? null;
      }
      return (await tx.importPayment.findUnique({ where: { id: paymentId }, select: { status: true } }))?.status ?? null;
    });
  }

  /** Reverse a charge we must not keep; on failure, flag the row for support instead of pretending. */
  /**
   * Atmos docs (docs.atmos.uz, "Transaction cancellation"): reverse takes the COMPLETED transaction id, i.e.
   * `success_trans_id` from apply/get, not the create-time transaction_id we store. Resolve it, fall back to ours.
   */
  private async reverseIdFor(transactionId: number): Promise<number> {
    const remote = await this.atmos.getTransaction(transactionId).catch(() => null);
    const s = Number(remote?.successTransId);
    return Number.isFinite(s) && s > 0 ? s : transactionId;
  }

  private async reverseOrFlag(paymentId: string, transactionId: number, reason: string): Promise<boolean> {
    try {
      await this.atmos.reverseTransaction({ transactionId: await this.reverseIdFor(transactionId), reason, idempotencyKey: paymentId });
      return true;
    } catch (e) {
      await this.prisma.importPayment.update({ where: { id: paymentId }, data: { needsAttention: true } }).catch(() => undefined);
      this.logger.error(`Reverse failed for payment ${paymentId}: ${(e as Error).message}`);
      return false;
    }
  }

  // ---------------------------------------------------------------- Web Plus pass (WEB_PLUS_PASS, off by default)

  /** Admin PlatformSetting > env > relayed defaults (24,990 / 199,990 soʻm). */
  async plusConfig() {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: Object.values(PLUS_SETTING_KEYS) } } }).catch(() => []);
    const settings = Object.fromEntries(rows.map((r) => [r.key, r.value as unknown]));
    return plusPassConfig(process.env, Math.ceil(this.atmos.minAmountTiyins() / 100), settings);
  }

  /** Benefits of an active Plus entitlement (any source), or null. Config defaults are neutral (0 %). */
  async plusBenefitsFor(userId: string) {
    const ent = await this.prisma.entitlement.findFirst({
      where: { userId, kind: 'plus', status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { expiresAt: 'desc' },
    });
    return ent ? { expiresAt: ent.expiresAt, benefits: (await this.plusConfig()).benefits } : null;
  }

  async plusOffer(userId: string) {
    const cfg = await this.plusConfig();
    const active = await this.plusBenefitsFor(userId);
    const on = cfg.enabled && this.gatewayEnabled() && this.atmos.configured();
    const play = await this.prisma.entitlement.findFirst({ where: { userId, kind: 'plus', source: 'google_play', status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    return {
      enabled: on && cfg.plans.length > 0,
      plans: on ? cfg.plans.map((p) => ({ days: p.days, priceUzs: p.priceUzs, sku: p.sku })) : [],
      benefits: cfg.benefits,
      active: Boolean(active),
      expiresAt: active?.expiresAt ?? null,
      /** Plus from Google Play: hide the web paywall, show "manage in Google Play". */
      playActive: Boolean(play),
      recurring: false,
      /** Paywall numbers from admin config (PAYMENTS §14): never hardcoded in the UI. */
      limits: await this.plusLimits(cfg.benefits.importDiscountPct),
    };
  }

  /** Enforced daily caps (lookups + quizzes, Free and Plus) and the live import discount. */
  async plusLimits(importDiscountPct: number) {
    // Same runtime source (≤ 60 s cache) the enforcement uses: platform_settings caps.* (WLF-12), never plan columns.
    const caps = await getPlanCaps(this.prisma);
    return { plusLookups: caps.plus.lookups, freeLookups: caps.free.lookups, plusQuizzes: caps.plus.quizzes, freeQuizzes: caps.free.quizzes, importDiscountPct };
  }

  async plusCheckout(userId: string, days: number, acceptOferta?: unknown) {
    // G1: no Plus checkout without an explicit Public Offer acceptance (recorded per purchase below).
    if (acceptOferta !== true) throw new BadRequestException({ message: 'Please accept the Public Offer to continue.', code: 'oferta_required' });
    const ofertaAcceptedAt = new Date();
    const cfg = await this.plusConfig();
    if (!cfg.enabled) throw new NotFoundException({ message: 'Plus is not sold on the web yet.', code: 'plus_unavailable' });
    if (!this.gatewayEnabled() || !this.atmos.configured()) throw new ServiceUnavailableException('Payment gateway is not available');
    const play = await this.prisma.entitlement.findFirst({ where: { userId, kind: 'plus', source: 'google_play', status: 'active', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } });
    if (play) throw new ConflictException({ message: 'Your Plus is managed in Google Play.', code: 'plus_via_play' });
    const plan = cfg.plans.find((p) => p.days === days);
    if (!plan) throw new BadRequestException({ message: 'This Plus plan is not available.', code: 'plus_unavailable' });
    const amountTiyins = plan.priceUzs * 100;
    const format = plusPassFormat(plan.days);
    const reusable = await this.prisma.importPayment.findFirst({
      where: { userId, status: ImportPaymentStatus.pending, contentFormat: format, amountTiyins, providerPaymentId: { not: null }, expiresAt: { gt: new Date(Date.now() + 5 * 60_000) } },
      orderBy: { createdAt: 'desc' },
    });
    if (reusable) {
      await this.prisma.importPayment.update({ where: { id: reusable.id }, data: { ofertaVersion: OFERTA_VERSION, ofertaAcceptedAt } });
      return { paymentId: reusable.id, account: reusable.account, transactionId: Number(reusable.providerPaymentId), amountUzs: plan.priceUzs, days: plan.days, status: 'pending', step: 'card' as const, reused: true };
    }
    const account = `${PLUS_ACCOUNT_PREFIX}${plan.days}_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
    const created = await this.atmos.createTransaction({ amountTiyins, account });
    const payment = await this.prisma.importPayment.create({
      data: {
        userId, account, amountTiyins, currency: 'UZS', estimatedPages: 0, contentFormat: format,
        importType: ImportType.paste, status: ImportPaymentStatus.pending, provider: 'atmos',
        providerPaymentId: String(created.transactionId), rawCreateJson: redactAtmosRaw(created.raw) as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 60 * 60_000), ofertaVersion: OFERTA_VERSION, ofertaAcceptedAt,
      },
    });
    return { paymentId: payment.id, account, transactionId: created.transactionId, amountUzs: plan.priceUzs, days: plan.days, status: 'pending', step: 'card' as const, reused: false };
  }

  /** Paid Plus payment → plus entitlement (idempotent on source+sourceRef+kind), stacked on any active pass. */
  async fulfillPlusPass(payment: { id: string; userId: string; status: ImportPaymentStatus; contentFormat: string; providerPaymentId?: string | null }) {
    const days = plusPassDaysFromFormat(payment.contentFormat) as PlusPassDays | null;
    if (!days || payment.status !== ImportPaymentStatus.paid) return;
    // Idempotency: one pass per Atmos transaction id (unique source+sourceRef+kind), and one per payment row.
    const sourceRef = payment.providerPaymentId || payment.id;
    // PAY1-03: per-user transaction lock so two passes paid at the same moment stack on each other, not on the same base.
    await this.prisma.$transaction(async (tx) => {
      await lockUserPlus(tx, payment.userId);
      const exists = await tx.entitlement.findFirst({ where: { kind: 'plus', OR: [{ source: 'atmos', sourceRef }, { importPaymentId: payment.id }] } });
      if (exists) return;
      const now = new Date();
      const current = await tx.entitlement.findFirst({
        where: { userId: payment.userId, kind: 'plus', status: 'active', expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
      });
      const startsAt = current?.expiresAt && current.expiresAt > now ? current.expiresAt : now;
      await tx.entitlement.create({
        data: {
          userId: payment.userId, kind: 'plus', source: 'atmos', sourceRef, importPaymentId: payment.id,
          sku: `plus_pass_${days}`, status: 'active', startsAt, expiresAt: plusPassExpiry(current?.expiresAt, days, now),
        },
      }).catch((e: { code?: string }) => { if (e?.code !== 'P2002') throw e; }); // concurrent webhook + apply
    });
    await projectPlus(this.prisma, payment.userId);
  }

  /** PAY2-01: per-payment Atmos status-check backoff (in-process; the 24 h cap below is derived from expiresAt, so a restart only re-checks sooner). */

  /**
   * PAY1-08 / PAY2-01 (every 10 min): pending payments past their 60-min session.
   * - No Atmos transaction yet → nothing can have been charged → expired.
   * - Ask Atmos: confirmed → paid via the normal conditional path (fulfils once).
   *   A definitive non-paid answer (a store_transaction with confirmed=false) → expired.
   * - Atmos unreachable / error / no definitive answer → stays PENDING, retried with exponential backoff
   *   (10 min doubling, max 2 h). Only after EXPIRY_UNVERIFIED_CAP_MS (24 h) past expiresAt is it expired
   *   unverified with needsAttention=true for manual review (a late callback still grants, see markPaid).
   * Never touches non-pending rows.
   */
  async expireStalePending(now = new Date(), limit = 200) {
    // PAY2-12: oldest first (a backlog can't starve the oldest charges); backoff persisted in next_check_at so it
    // survives restarts and is shared by every API process. Rows still backing off are skipped in SQL.
    const stale = await this.prisma.importPayment.findMany({
      where: { status: ImportPaymentStatus.pending, expiresAt: { lte: now }, OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }, { expiresAt: { lte: new Date(now.getTime() - EXPIRY_UNVERIFIED_CAP_MS) } }] },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'asc' }],
      take: limit,
    });
    let paid = 0, expired = 0, deferred = 0, flagged = 0;
    const expire = async (id: string, data: Prisma.ImportPaymentUpdateManyMutationInput = {}) => {
      const r = await this.prisma.importPayment.updateMany({ where: { id, status: ImportPaymentStatus.pending }, data: { status: ImportPaymentStatus.expired, nextCheckAt: null, ...data } });
      return r.count;
    };
    for (const p of stale) {
      const tx = Number(p.providerPaymentId);
      if (!(Number.isFinite(tx) && tx > 0)) { expired += await expire(p.id); continue; }
      const overCap = p.expiresAt != null && now.getTime() - p.expiresAt.getTime() >= EXPIRY_UNVERIFIED_CAP_MS;
      let remote: Awaited<ReturnType<AtmosClient['getTransaction']>> | null = null;
      let failed = !this.atmos.configured();
      if (!failed) {
        try { remote = await this.atmos.getTransaction(tx); } catch (e) { failed = true; this.logger.warn(`expiry check ${p.id}: Atmos error ${(e as Error).message}`); }
      }
      if (remote?.confirmed) { if (await this.markPaid(p.account, { ofdUrl: remote.ofdUrl, raw: remote.raw, late: true })) paid++; continue; }
      const definitive = !failed && remote != null && (remote.raw as { store_transaction?: unknown } | null)?.store_transaction != null;
      // PAY2-23: a definitive no resolves the payment_under_review flag too (nothing was charged).
      if (definitive) { expired += await expire(p.id, p.needsAttention && reviewFlagOnly(p) ? { needsAttention: false } : {}); continue; }
      if (overCap) {
        const n = await expire(p.id, { needsAttention: true, cancelReason: 'expired_unverified: Atmos status unknown after 24 h' });
        expired += n; flagged += n;
        this.logger.warn(`payment ${p.id}: expired unverified after 24 h, flagged for manual review`);
        continue;
      }
      const attempts = (p.expiryCheckAttempts ?? 0) + 1;
      await this.prisma.importPayment.updateMany({
        where: { id: p.id, status: ImportPaymentStatus.pending },
        data: { expiryCheckAttempts: attempts, nextCheckAt: new Date(now.getTime() + Math.min(EXPIRY_BACKOFF_MAX_MS, EXPIRY_BACKOFF_BASE_MS * 2 ** (attempts - 1))) },
      });
      deferred++;
    }
    return { checked: stale.length, paid, expired, deferred, flagged };
  }

  /** Daily: lapsed passes → expired, then re-project so quotas stop granting Plus. */
  async expirePasses(now = new Date()) {
    const lapsed = await this.prisma.entitlement.findMany({ where: { kind: 'plus', status: 'active', expiresAt: { lte: now } }, select: { userId: true }, take: 5000 });
    if (lapsed.length) await this.prisma.entitlement.updateMany({ where: { kind: 'plus', status: 'active', expiresAt: { lte: now } }, data: { status: 'expired' } });
    const subs = await this.prisma.userSubscription.findMany({ where: { status: 'active', currentPeriodEnd: { lte: now } }, select: { userId: true }, take: 5000 });
    if (subs.length) await this.prisma.userSubscription.updateMany({ where: { status: 'active', currentPeriodEnd: { lte: now } }, data: { status: 'canceled' } });
    for (const u of new Set(lapsed.map((r) => r.userId))) await projectPlus(this.prisma, u).catch(() => undefined);
    return { passes: lapsed.length, subscriptions: subs.length };
  }

  /** Renewal reminders (the pass never auto-renews). Deduped per entitlement+threshold via UserNotification. */
  async sendPlusReminders(now = new Date()) {
    const cfg = await this.plusConfig();
    if (!cfg.enabled || !cfg.reminderDays.length) return 0;
    const horizon = new Date(now.getTime() + Math.max(1, ...cfg.reminderDays) * 86_400_000);
    const rows = await this.prisma.entitlement.findMany({
      where: { kind: 'plus', source: 'atmos', status: 'active', expiresAt: { gt: now, lte: horizon } },
      take: 500,
    });
    let sent = 0;
    for (const e of rows) {
      // Only remind on the pass that ends last (a stacked pass extends it).
      const later = await this.prisma.entitlement.findFirst({ where: { userId: e.userId, kind: 'plus', status: 'active', expiresAt: { gt: e.expiresAt! } } });
      if (later) continue;
      const d = dueReminder(e.expiresAt!, cfg.reminderDays, now);
      if (d == null) continue;
      try {
        await this.prisma.userNotification.create({
          data: {
            userId: e.userId, kind: 'plus_renewal', refId: e.id, href: '/app/plus',
            title: d === 0 ? 'Plus ends today' : d === 1 ? 'Plus ends tomorrow' : `Plus ends in ${d} days`,
            body: 'Your Plus pass does not renew by itself. Buy a new pass to keep Plus.',
            dedupeKey: `plus_renewal:${e.id}:${d}`,
          },
        });
        sent += 1;
      } catch { /* unique(userId, dedupeKey): already reminded */ }
    }
    return sent;
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
    if (plusPassDaysFromFormat(payment.contentFormat)) throw new BadRequestException('This payment is for Plus, not an import.');
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
        tier: allowance.tier ?? 'free',
        message: overDaily
          ? `${allowance.tier === 'plus' ? 'Import' : 'Free import'} limit reached: ${allowance.dailyFreeImportsPerUser} imports a day.`
          : `${allowance.tier === 'plus' ? 'Import' : 'Free import'} limit reached: ${allowance.monthlyFreePageLimit} pages a month (${allowance.monthlyPagesRemaining} left).`,
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

  /**
   * payments-02 import money-safety (minimal; folds into the import-p0 queue later).
   * A paid import that ended `failed` (error, stuck, or lost after a restart) is settled exactly once:
   *  - attempts < MAX_FREE_IMPORT_RETRIES → the SAME payment is released for a free retry (no new charge);
   *  - otherwise → refund_due + needsAttention, so an admin refunds through the reverse path (auto-reverse is
   *    not safe here: the learner may already hold part of the content).
   * Idempotent: the conditional write matches only while the payment is still attached to that failed import.
   */
  async settleFailedImport(userImportId: string): Promise<'retry' | 'refund_due' | null> {
    if ((await this.queueOwnedImportIds([userImportId])).has(userImportId)) return null; // import-p0 queue owns it
    const payment = await this.prisma.importPayment.findFirst({ where: { userImportId, status: ImportPaymentStatus.paid } });
    if (!payment) return null;
    const imp = await this.prisma.userImport.findUnique({ where: { id: userImportId }, select: { ingestionStatus: true } });
    if (imp?.ingestionStatus !== 'failed') return null;
    if ((payment.importAttempts ?? 0) < MAX_FREE_IMPORT_RETRIES) {
      const r = await this.prisma.importPayment.updateMany({
        where: { id: payment.id, userImportId, status: ImportPaymentStatus.paid },
        data: { userImportId: null, importAttempts: { increment: 1 } },
      });
      return r.count === 1 ? 'retry' : null;
    }
    const r = await this.prisma.importPayment.updateMany({
      // Claimed once: only the caller whose conditional update hits the row flags it.
      where: { id: payment.id, userImportId, status: ImportPaymentStatus.paid, refundDue: false },
      data: { refundDue: true, needsAttention: true },
    });
    if (r.count === 1) this.logger.warn(`Import ${userImportId} failed after ${payment.importAttempts} free retries: payment ${payment.id} is refund-due`);
    return r.count === 1 ? 'refund_due' : null;
  }

  /**
   * Imports that have a row in import-p0's queue (import_queue_jobs, migration 0030) belong to that worker
   * (its own heartbeat, retry and refund-due). Same filter as import-p0, so the two never fight.
   * Before 0030 exists the table is missing → empty set → this sweep covers every import.
   */
  async queueOwnedImportIds(ids?: string[]): Promise<Set<string>> {
    const db = this.prisma as unknown as { $queryRaw?: (q: TemplateStringsArray, ...v: unknown[]) => Promise<Array<Record<string, unknown>>> };
    if (typeof db.$queryRaw !== 'function') return new Set();
    try {
      const [t] = await db.$queryRaw`SELECT to_regclass('public.import_queue_jobs') IS NOT NULL AS present`;
      if (!t?.present) return new Set();
      const rows = ids
        ? await db.$queryRaw`SELECT DISTINCT user_import_id::text AS id FROM import_queue_jobs WHERE user_import_id = ANY(${ids}::uuid[])`
        : await db.$queryRaw`SELECT DISTINCT j.user_import_id::text AS id FROM import_queue_jobs j JOIN user_imports u ON u.id = j.user_import_id WHERE u.ingestion_status::text IN ('queued','processing','tokenizing')`;
      return new Set(rows.map((r) => String(r.id)));
    } catch {
      return new Set();
    }
  }

  /** Payments released by settleFailedImport that the learner can still use for a free retry, and refund-due ones. */
  async importRetryState(userId: string) {
    const db = this.prisma.importPayment;
    const [retry, refundDue] = await Promise.all([
      db.findMany({
        where: {
          userId, status: ImportPaymentStatus.paid, userImportId: null, refundDue: false,
          // failed paid import (payments-02) OR paid late with no import ever run (PAY2-08)
          OR: [{ importAttempts: { gt: 0 } }, { cancelReason: LATE_UNATTACHED }],
        },
        select: { id: true, importType: true, cancelReason: true },
      }),
      db.count({ where: { userId, status: ImportPaymentStatus.paid, refundDue: true } }),
    ]).catch(() => [[], 0] as const);
    return {
      freeRetries: retry.map((p) => ({ paymentId: p.id, importType: p.importType, ...(p.cancelReason === LATE_UNATTACHED ? { reason: 'paid_late' as const } : {}) })),
      refundDue,
    };
  }

  /** Sweep (start-up + every few minutes, after the stale-import watchdog): settle every failed paid import. */
  async settleFailedImports(limit = 200, now = new Date()) {
    // PAY2-08: late-paid imports the learner never used → refund-due (admin reverse path), still flagged.
    await this.prisma.importPayment.updateMany({
      where: { status: ImportPaymentStatus.paid, userImportId: null, refundDue: false, cancelReason: LATE_UNATTACHED, paidAt: { lte: new Date(now.getTime() - LATE_UNATTACHED_REFUND_MS) } },
      data: { refundDue: true, needsAttention: true },
    }).catch(() => undefined);
    const attached = await this.prisma.importPayment.findMany({
      where: { status: ImportPaymentStatus.paid, userImportId: { not: null }, refundDue: false },
      select: { userImportId: true }, take: limit, orderBy: { paidAt: 'asc' },
    });
    const ids = attached.map((p) => p.userImportId!).filter(Boolean);
    if (!ids.length) return { retry: 0, refundDue: 0 };
    const owned = await this.queueOwnedImportIds(ids);
    const failed = (await this.prisma.userImport.findMany({ where: { id: { in: ids }, ingestionStatus: 'failed' }, select: { id: true } })).filter((f) => !owned.has(f.id));
    let retry = 0, refundDue = 0;
    for (const f of failed) {
      const r = await this.settleFailedImport(f.id).catch(() => null);
      if (r === 'retry') retry++; else if (r === 'refund_due') refundDue++;
    }
    return { retry, refundDue };
  }

  async attachUserImport(paymentId: string, userImportId: string) {
    await this.prisma.importPayment.update({
      where: { id: paymentId },
      data: { userImportId },
    });
    // PAY2-08: the late-paid import was delivered after all → resolved, clear the review flag.
    await this.prisma.importPayment.updateMany({
      where: { id: paymentId, cancelReason: LATE_UNATTACHED, refundDue: false },
      data: { needsAttention: false, cancelReason: null },
    }).catch(() => undefined);
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
    // PAY1-04: the callback must name OUR Atmos transaction; providerPaymentId is never overwritten.
    const cbTx = String(body.transaction_id ?? '');
    if (!payment.providerPaymentId || !cbTx || cbTx !== String(payment.providerPaymentId)) {
      this.logger.warn(`Atmos callback tx mismatch for payment ${payment.id}`);
      return { status: 0, message: 'Transaction mismatch' };
    }
    if (payment.status === ImportPaymentStatus.paid) {
      await this.settlePaid(payment.id); // idempotent re-check of the catalog grant
      return { status: 1, message: 'Successfully' };
    }
    if (payment.status === ImportPaymentStatus.expired) {
      // PAY2-01: late success for a session the sweeper expired → the card WAS charged; grant (idempotent).
      const late = await this.markPaid(invoice, { raw: body });
      if (late) this.logger.warn(`late Atmos success for expired payment ${payment.id}: delivered`);
      return late ? { status: 1, message: 'Successfully' } : { status: 0, message: `Payment status is ${payment.status}` };
    }
    if (payment.status !== ImportPaymentStatus.pending) {
      return { status: 0, message: `Payment status is ${payment.status}` };
    }

    await this.markPaid(invoice, { raw: body });
    return { status: 1, message: 'Successfully' };
  }

  /** Admin overview helpers */
  async revenueStats() {
    const monthStart = this.startOfTashkentMonth();
    const dayStart = this.startOfTashkentDay();
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
      revenueFromImportsUzs: Math.round((paidMonth._sum.amountTiyins ?? 0) / 100), // PAY1-13
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
    const listPriceUzs = catalogPriceUzs(item);
    // The learner sees only their own price: Plus discount applied server-side, never a second "member price".
    const plus = !accessGranted && listPriceUzs > 0 ? await this.plusBenefitsFor(userId) : null;
    const minTiyins = this.atmos.minAmountTiyins();
    const priceUzs = plus
      ? Math.round((listPriceUzs * 100 - plusDiscountTiyins(listPriceUzs * 100, plus.benefits.bookDiscountPct, minTiyins)) / 100)
      : listPriceUzs;
    return {
      contentId: item.id,
      title: item.title,
      isFree: !requiresCatalogPayment(item),
      priceUzs,
      plusApplied: priceUzs < listPriceUzs,
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

    assertPaymentsEnabled(); // final-5 B4: no paid purchase can start while PAYMENTS_UI_ENABLED is off
    if (!this.catalogPaymentsEnabled()) {
      throw new ServiceUnavailableException('Payment gateway is not available for catalog purchases');
    }

    const listTiyins = Math.round(access.priceUzs * 100);
    const minTiyins = this.atmos.minAmountTiyins();
    const promo = promoCode?.trim() && this.pricing ? await this.pricing.resolvePromo(promoCode, userId, 'catalog') : null;
    // Plus book discount is already in access.priceUzs; add the promo, then cap the COMBINED discount at 70 % of list.
    const listItem = await this.prisma.contentItem.findUnique({ where: { id: contentId } });
    const fullListTiyins = Math.max(listTiyins, Math.round((listItem ? catalogPriceUzs(listItem) : access.priceUzs) * 100));
    const combined = (fullListTiyins - listTiyins) + (promo ? promoDiscountTiyins(listTiyins, promo, minTiyins) : 0);
    const amountTiyins = fullListTiyins - capTotalDiscountTiyins(fullListTiyins, combined, minTiyins);
    if (amountTiyins < minTiyins) {
      throw new BadRequestException(
        'Payment could not be processed for this book. Please try again later or contact support.',
      );
    }

    // P1 double-submit guard for book unlocks: reuse an open pending payment for the same book.
    const reusable = await this.prisma.importPayment.findFirst({
      where: {
        userId, status: ImportPaymentStatus.pending, contentFormat: catalogPaymentFormat(contentId), amountTiyins,
        providerPaymentId: { not: null }, expiresAt: { gt: new Date(Date.now() + 5 * 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (reusable) {
      return {
        ...access, paymentId: reusable.id, account: reusable.account, transactionId: Number(reusable.providerPaymentId),
        status: reusable.status, step: 'card' as const, reused: true,
      };
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
        rawCreateJson: redactAtmosRaw(atmosTx.raw) as Prisma.InputJsonValue,
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

/** Never send raw Atmos create/callback JSON to learners (it echoes card masks, merchant ids, signatures). */
export function stripProviderRaw<T extends { rawCreateJson?: unknown; rawCallbackJson?: unknown }>(p: T) {
  const { rawCreateJson: _a, rawCallbackJson: _b, ...rest } = p;
  return rest;
}

export type PaymentSummary = {
  id: string;
  kind: 'import' | 'catalog' | 'play' | 'plus' | 'admin_grant';
  source: 'atmos' | 'google_play' | 'admin';
  /** Plus pass length / grant end, when relevant. */
  plusDays?: number | null;
  endsAt?: string | null;
  /** Our own receipt (GET /billing/payments/:id/receipt) — Atmos only. */
  ownReceiptPath?: string | null;
  needsAttention: boolean;
  contentId: string | null;
  status: string;
  amountUzs: number;
  currency: string;
  estimatedPages: number;
  contentFormat: string;
  createdAt: string;
  paidAt: string | null;
  receiptUrl: string | null;
};

export function toPaymentSummary(p: {
  id: string;
  account: string;
  status: string;
  amountTiyins: number;
  currency: string;
  estimatedPages: number;
  contentFormat: string;
  createdAt: Date;
  paidAt: Date | null;
  ofdUrl: string | null;
  expiresAt?: Date | null;
  needsAttention?: boolean;
}): PaymentSummary {
  const receipt = p.ofdUrl && /^https:\/\//i.test(p.ofdUrl) ? p.ofdUrl : null;
  const catalog = p.account.startsWith('cat_');
  const plusDays = plusPassDaysFromFormat(p.contentFormat);
  return {
    id: p.id,
    kind: plusDays ? 'plus' : catalog ? 'catalog' : 'import',
    source: 'atmos',
    plusDays,
    ownReceiptPath: p.status === 'paid' || p.status === 'refunded' ? `/billing/payments/${p.id}/receipt` : null,
    // P2: flagged by us (failed reverse) or still pending after its session window → manual-review support line.
    needsAttention: Boolean(p.needsAttention) || (p.status === 'pending' && !!p.expiresAt && p.expiresAt.getTime() < Date.now()),
    contentId: catalog ? catalogContentIdFromFormat(p.contentFormat) : null,
    status: p.status,
    amountUzs: Math.round(p.amountTiyins / 100),
    currency: p.currency || 'UZS',
    estimatedPages: p.estimatedPages,
    contentFormat: p.contentFormat,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    receiptUrl: receipt,
  };
}

const PLAY_STATUS: Record<string, string> = { purchased: 'paid', pending: 'pending', canceled: 'failed', expired: 'expired', refunded: 'refunded', revoked: 'refunded' };

export function toPlaySummary(p: { id: string; sku: string; kind: string; state: string; createdAt: Date }): PaymentSummary {
  return {
    id: p.id,
    kind: 'play',
    source: 'google_play',
    needsAttention: false,
    contentId: null,
    status: PLAY_STATUS[p.state] ?? p.state,
    amountUzs: 0, // Play price lives in Google's receipt; the web never shows Play prices (PRICING §6).
    currency: 'UZS',
    estimatedPages: 0,
    contentFormat: p.kind,
    createdAt: p.createdAt.toISOString(),
    paidAt: null,
    receiptUrl: null,
  };
}

/** Legal details are NOT known yet: keep explicit placeholders (Lead brief 13:51 UTC+5). */
export const SELLER = { en: 'the Erkin Tizim team', uz: 'Erkin Tizim jamoasi', ru: 'команда Erkin Tizim' } as const;
/** Placeholder until Legal provides it; never invent one. */
export const OFERTA_URL: string | null = null;
/** The single refund rule (PAYMENTS §14, PM decision A), same wording as pay.trust.refund (en), UI/UX pay-copy.json 17:08 (round-3b). */
export const REFUND_RULE_EN = "If an import or book is not delivered or does not work as described, you may choose the remedy: we fix it (we fix or re-run the import, or unlock the book again), we reduce the price, or we cancel the purchase and return your money. We always return money for a duplicate charge or a failed charge. Please contact support@gotchaa.uz within 14 calendar days of noticing a problem; this does not shorten any period set by law. Refunds go to the same card through Atmos within 10 working days of approval.";

type PlusTx = Pick<Prisma.TransactionClient, 'entitlement'> & { $executeRaw?: unknown };
/** PAY1-03: Postgres transaction-scoped advisory lock per user (released at COMMIT/ROLLBACK). */
export async function lockUserPlus(tx: PlusTx, userId: string) {
  if (typeof (tx as { $executeRaw?: unknown }).$executeRaw === 'function') {
    await (tx as Prisma.TransactionClient).$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`plus:${userId}`}, 0))`;
  }
}

/**
 * PAY1-02: when the pass granted by `paymentId` is refunded, remove its UNUSED days from the chain:
 * unused = expiresAt - max(now, startsAt). Later active passes of the same user (startsAt >= its expiresAt) move back by that.
 */
export async function shiftStackedPlusAfterRefund(tx: PlusTx, paymentId: string, now: Date) {
  const ent = await tx.entitlement.findFirst({ where: { importPaymentId: paymentId, kind: 'plus', status: 'active' } });
  if (!ent?.expiresAt) return 0;
  await lockUserPlus(tx, ent.userId);
  const start = ent.startsAt && ent.startsAt > now ? ent.startsAt : now;
  const unusedMs = Math.max(0, ent.expiresAt.getTime() - start.getTime());
  if (!unusedMs) return 0;
  const later = await tx.entitlement.findMany({ where: { userId: ent.userId, kind: 'plus', status: 'active', startsAt: { gte: ent.expiresAt } } });
  let moved = 0;
  for (const e of later) {
    if (e.id === ent.id || !e.expiresAt || !e.startsAt || e.startsAt.getTime() < ent.expiresAt.getTime()) continue;
    await tx.entitlement.update({ where: { id: e.id }, data: { startsAt: new Date(e.startsAt.getTime() - unusedMs), expiresAt: new Date(e.expiresAt.getTime() - unusedMs) } });
    moved++;
  }
  return moved;
}

/** PAY1-06: keep only the Atmos fields we need; drop card masks, phone, tokens and anything else. */
const ATMOS_KEEP = ['store_id', 'transaction_id', 'success_trans_id', 'invoice', 'amount', 'transaction_time', 'ofd_url', 'status', 'confirmed', 'code', 'description'];
export function redactAtmosRaw(raw: unknown, depth = 0): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || depth > 2) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (ATMOS_KEEP.includes(k) && (v === null || ['string', 'number', 'boolean'].includes(typeof v))) out[k] = k === 'description' && typeof v === 'string' ? v.replace(/[\d*][\d* ]{2,}[\d*]/g, '****').slice(0, 160) : v;
    else if ((k === 'result' || k === 'store_transaction') && v && typeof v === 'object') out[k] = redactAtmosRaw(v, depth + 1);
  }
  return out;
}
