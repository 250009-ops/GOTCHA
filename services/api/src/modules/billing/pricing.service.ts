import { resetPlanCapsCache } from '../../common/plan-caps';
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type PromoCode, type SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type PricingLang = 'en' | 'ru' | 'uz';
export type PromoScope = 'imports' | 'catalog';
export const PROMO_MAX_PERCENT = 70; // PRICING.md §3.6: max total discount 70%
export const PLAN_PERIODS = ['month', 'year', 'one_time'] as const;

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Discount in tiyins for a list price, honouring the 70% cap and the Atmos minimum charge.
 * Pure: used by checkout and by tests.
 */
export function promoDiscountTiyins(listTiyins: number, promo: Pick<PromoCode, 'percentOff' | 'amountOffUzs'>, minChargeTiyins: number): number {
  if (listTiyins <= 0) return 0;
  const raw = promo.percentOff != null ? Math.floor((listTiyins * promo.percentOff) / 100) : (promo.amountOffUzs ?? 0) * 100;
  const capped = Math.min(raw, Math.floor((listTiyins * PROMO_MAX_PERCENT) / 100));
  const floorToMin = Math.max(0, listTiyins - minChargeTiyins);
  return Math.max(0, Math.min(capped, floorToMin));
}

/** DB-driven plans, page tiers and promo codes (admin-editable; no prices in code). */
@Injectable()
export class PricingService {
  constructor(private prisma: PrismaService) {}

  planName(plan: Pick<SubscriptionPlan, 'name' | 'nameI18n'>, lang: PricingLang): string {
    const i18n = (plan.nameI18n ?? {}) as Record<string, string>;
    return i18n[lang] || i18n.en || plan.name;
  }

  async publicPlans(lang: PricingLang = 'en') {
    const plans = await this.prisma.subscriptionPlan.findMany({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { tier: 'asc' }] });
    return plans.map((p) => ({
      id: p.id,
      tier: p.tier,
      name: this.planName(p, lang),
      priceUzs: Math.round(Number(p.priceMonthly ?? 0)),
      period: p.period,
      currency: 'UZS' as const,
      aiDailyQuota: p.aiDailyQuota,
      quizDailyQuota: p.quizDailyQuota,
      importLimit: p.importLimit,
      offlineEnabled: p.offlineEnabled,
      features: Array.isArray(p.features) ? (p.features as string[]) : [],
    }));
  }

  activeTiers() {
    return this.prisma.importPageTier.findMany({ where: { active: true }, orderBy: [{ minPages: 'asc' }, { sortOrder: 'asc' }] });
  }

  /** Validate a code for a learner + scope. Throws 400 with a stable `code` the clients localize. */
  async resolvePromo(rawCode: string, userId: string, scope: PromoScope, now = new Date()): Promise<PromoCode> {
    const code = normalizePromoCode(rawCode);
    const promo = await this.prisma.promoCode.findUnique({ where: { code } });
    const bad = (c: string, m: string) => new BadRequestException({ message: m, code: c });
    if (!promo || !promo.active) throw bad('promo_invalid', 'This promo code is not valid.');
    if (promo.appliesTo !== 'all' && promo.appliesTo !== scope) throw bad('promo_not_applicable', 'This promo code does not apply here.');
    if ((promo.validFrom && now < promo.validFrom) || (promo.validTo && now > promo.validTo)) throw bad('promo_expired', 'This promo code has expired.');
    if (promo.maxRedemptions != null && promo.redemptions >= promo.maxRedemptions) throw bad('promo_exhausted', 'This promo code has been used up.');
    const used = await this.prisma.importPayment.count({ where: { userId, promoCodeId: promo.id, promoRedeemed: true } });
    if (used >= promo.perUserLimit) throw bad('promo_used', 'You have already used this promo code.');
    return promo;
  }

  /** Count a redemption exactly once, atomically, when a discounted payment becomes paid. */
  async redeemForPayment(paymentId: string) {
    const p = await this.prisma.importPayment.findUnique({ where: { id: paymentId }, select: { promoCodeId: true, promoRedeemed: true } });
    if (!p?.promoCodeId || p.promoRedeemed) return false;
    const claimed = await this.prisma.importPayment.updateMany({ where: { id: paymentId, promoRedeemed: false }, data: { promoRedeemed: true } });
    if (claimed.count !== 1) return false;
    await this.prisma.promoCode.update({ where: { id: p.promoCodeId }, data: { redemptions: { increment: 1 } } });
    return true;
  }

  // ------------------------------------------------------------------ admin

  async adminOverview() {
    const [plans, tiers, promos, storeProducts] = await Promise.all([
      this.prisma.subscriptionPlan.findMany({ orderBy: [{ sortOrder: 'asc' }, { tier: 'asc' }] }),
      this.prisma.importPageTier.findMany({ orderBy: [{ minPages: 'asc' }, { sortOrder: 'asc' }] }),
      this.prisma.promoCode.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.storeProduct.findMany({ orderBy: [{ platform: 'asc' }, { kind: 'asc' }, { sku: 'asc' }] }),
    ]);
    return {
      currency: 'UZS',
      plans: plans.map((p) => ({ ...p, priceUzs: Math.round(Number(p.priceMonthly ?? 0)), priceMonthly: undefined })),
      tiers: tiers.map((t) => ({ ...t, priceUzs: Math.round(Number(t.priceUsd)), priceUsd: undefined })),
      promos,
      storeProducts,
    };
  }

  /** Per-platform SKU mapping (Play prices may differ from web, e.g. +15% for Google's fee). */
  async upsertStoreProduct(b: StoreProductInput, id?: string) {
    const kind = b.kind;
    if (kind === 'subscription' && !b.planTier) throw new BadRequestException('Subscription SKUs need a plan.');
    if (kind === 'import_tier' && !b.importTierId) throw new BadRequestException('Import SKUs need a page tier.');
    if (kind === 'catalog_book' && !b.contentId) throw new BadRequestException('Book SKUs need a book id.');
    const data = {
      platform: b.platform, sku: b.sku.trim(), kind, priceUzs: b.priceUzs, active: b.active ?? true,
      planTier: kind === 'subscription' ? (b.planTier as SubscriptionPlan['tier']) : null,
      importTierId: kind === 'import_tier' ? b.importTierId! : null,
      contentId: kind === 'catalog_book' ? b.contentId! : null,
    };
    try {
      if (id) {
        const before = await this.prisma.storeProduct.findUnique({ where: { id } });
        if (!before) throw new NotFoundException('Store product not found');
        return { before, after: await this.prisma.storeProduct.update({ where: { id }, data }) };
      }
      return { before: null, after: await this.prisma.storeProduct.create({ data }) };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('That SKU already exists on this platform.');
      throw e;
    }
  }

  async updatePlan(tier: string, body: PlanUpdate) {
    const plan = await this.prisma.subscriptionPlan.findFirst({ where: { tier: tier as SubscriptionPlan['tier'] } });
    if (!plan) throw new NotFoundException('Plan not found');
    const data: Prisma.SubscriptionPlanUpdateInput = {};
    if (body.nameI18n) {
      const n = body.nameI18n;
      if (!n.en?.trim()) throw new BadRequestException('English name is required.');
      data.nameI18n = { en: n.en.trim(), ru: (n.ru || n.en).trim(), uz: (n.uz || n.en).trim() };
      data.name = n.en.trim();
    }
    if (body.priceUzs != null) {
      if (!Number.isInteger(body.priceUzs) || body.priceUzs < 0 || body.priceUzs > 100_000_000) throw new BadRequestException('Price must be a whole number of UZS.');
      if (plan.tier === 'free' && body.priceUzs !== 0) throw new BadRequestException('The free plan must cost 0.');
      data.priceMonthly = body.priceUzs;
    }
    if (body.period != null) {
      if (!PLAN_PERIODS.includes(body.period as never)) throw new BadRequestException('Unknown period.');
      data.period = body.period;
    }
    if (body.aiDailyQuota != null) data.aiDailyQuota = clampInt(body.aiDailyQuota, 0, 1_000_000);
    if (body.quizDailyQuota != null) data.quizDailyQuota = clampInt(body.quizDailyQuota, 0, 1_000_000);
    if (body.importLimit != null) data.importLimit = clampInt(body.importLimit, 0, 1_000_000); // WLF-12: legacy column, not enforced or shown (importFreeLimits is)
    if (body.offlineEnabled != null) data.offlineEnabled = !!body.offlineEnabled;
    if (body.features != null) {
      if (!Array.isArray(body.features) || body.features.some((f) => typeof f !== 'string' || !/^[a-z0-9_]{2,40}$/.test(f))) {
        throw new BadRequestException('Features are snake_case keys.');
      }
      data.features = [...new Set(body.features)];
    }
    if (body.active != null) {
      if (plan.tier === 'free' && !body.active) throw new BadRequestException('The free plan cannot be deactivated.');
      data.active = !!body.active;
    }
    const updated = await this.prisma.subscriptionPlan.update({ where: { id: plan.id }, data });
    resetPlanCapsCache();
    return { before: plan, after: updated };
  }

  async setTierActive(id: string, active: boolean) {
    const t = await this.prisma.importPageTier.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Tier not found');
    return { before: t, after: await this.prisma.importPageTier.update({ where: { id }, data: { active } }) };
  }

  async createPromo(body: PromoInput) {
    const data = validatePromo(body, true) as Prisma.PromoCodeCreateInput;
    try {
      return await this.prisma.promoCode.create({ data });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new BadRequestException('That code already exists.');
      throw e;
    }
  }

  async updatePromo(id: string, body: PromoInput) {
    const before = await this.prisma.promoCode.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Promo code not found');
    const merged = { ...before, ...body, code: before.code } as PromoInput;
    if (body.percentOff != null) merged.amountOffUzs = null;
    if (body.amountOffUzs != null) merged.percentOff = null;
    const data = validatePromo(merged, false);
    delete (data as Record<string, unknown>).code; // codes are immutable once shared
    return { before, after: await this.prisma.promoCode.update({ where: { id }, data }) };
  }
}

export type PlanUpdate = {
  nameI18n?: { en: string; ru?: string; uz?: string };
  priceUzs?: number;
  period?: string;
  aiDailyQuota?: number;
  quizDailyQuota?: number;
  importLimit?: number;
  offlineEnabled?: boolean;
  features?: string[];
  active?: boolean;
};

export type PromoInput = {
  code?: string;
  description?: string | null;
  percentOff?: number | null;
  amountOffUzs?: number | null;
  appliesTo?: string;
  validFrom?: string | Date | null;
  validTo?: string | Date | null;
  maxRedemptions?: number | null;
  perUserLimit?: number;
  active?: boolean;
};

function clampInt(v: number, min: number, max: number) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`Value must be between ${min} and ${max}.`);
  return n;
}

function validatePromo(b: PromoInput, creating: boolean): Prisma.PromoCodeUpdateInput & { code?: string } {
  const code = normalizePromoCode(b.code ?? '');
  if (creating && !/^[A-Z0-9_-]{3,32}$/.test(code)) throw new BadRequestException('Code: 3–32 characters, A–Z, 0–9, _ or -.');
  const hasPct = b.percentOff != null;
  const hasAmt = b.amountOffUzs != null;
  if (hasPct === hasAmt) throw new BadRequestException('Set either a percent or a fixed UZS discount.');
  if (hasPct && (!Number.isInteger(b.percentOff) || b.percentOff! < 1 || b.percentOff! > PROMO_MAX_PERCENT)) {
    throw new BadRequestException(`Percent must be 1–${PROMO_MAX_PERCENT}.`);
  }
  if (hasAmt && (!Number.isInteger(b.amountOffUzs) || b.amountOffUzs! <= 0)) throw new BadRequestException('Fixed discount must be a positive whole UZS amount.');
  const appliesTo = b.appliesTo ?? 'all';
  if (!['imports', 'catalog', 'all'].includes(appliesTo)) throw new BadRequestException('appliesTo must be imports, catalog or all.');
  const from = b.validFrom ? new Date(b.validFrom) : null;
  const to = b.validTo ? new Date(b.validTo) : null;
  if ((from && isNaN(+from)) || (to && isNaN(+to))) throw new BadRequestException('Invalid date.');
  if (from && to && to <= from) throw new BadRequestException('End date must be after the start date.');
  if (b.maxRedemptions != null && (!Number.isInteger(b.maxRedemptions) || b.maxRedemptions < 1)) throw new BadRequestException('Max redemptions must be ≥ 1.');
  const perUser = b.perUserLimit ?? 1;
  if (!Number.isInteger(perUser) || perUser < 1 || perUser > 100) throw new BadRequestException('Per-user limit must be 1–100.');
  return {
    ...(creating ? { code } : {}),
    description: b.description?.toString().slice(0, 200) || null,
    percentOff: hasPct ? b.percentOff! : null,
    amountOffUzs: hasAmt ? b.amountOffUzs! : null,
    appliesTo,
    validFrom: from,
    validTo: to,
    maxRedemptions: b.maxRedemptions ?? null,
    perUserLimit: perUser,
    active: b.active ?? true,
  };
}

export interface StoreProductInput {
  platform: 'web' | 'google_play';
  sku: string;
  kind: 'subscription' | 'import_tier' | 'catalog_book';
  planTier?: string | null;
  importTierId?: string | null;
  contentId?: string | null;
  priceUzs: number;
  active?: boolean;
}
