import { Injectable } from '@nestjs/common';
import { DAILY_CAP_FALLBACKS, DAILY_CAP_KEYS } from '@gotcha/shared';
import { activeSubWhere } from '../../common/plan-active';
import { getPlanCaps, usageDayStart, usageResetAt, userCapPlan } from '../../common/plan-caps';
import { SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatSom, planCopy, publicPlanPriceUzs, type PlanLang } from '../marketing/plan-copy';
import { ImportCommerceService } from './import-commerce.service';
import { PricingService, type PricingLang } from './pricing.service';
import { PLUS_SETTING_KEYS, plusPassConfig } from './plus-pass';

/** Subscription view of a plan row: DB values only (no prices or feature copy in code). */
export function enrichPlan(plan: SubscriptionPlan, lang: PlanLang = 'en', yearRaw?: unknown, freeQuota: number = DAILY_CAP_FALLBACKS.free.lookups, freeQuizzes: number = DAILY_CAP_FALLBACKS.free.quizzes, plusLookups: number | null = DAILY_CAP_FALLBACKS.plus.lookups, freeImportsDay?: number, plusQuizzes: number = DAILY_CAP_FALLBACKS.plus.quizzes, freePages: FreeImportPages = DEFAULT_FREE_IMPORT_PAGES, plusImports?: PlusImportLimits, passPrices?: PlusPassPrices, freeMashq: number = DAILY_CAP_FALLBACKS.free.mashq, plusMashq: number | null = DAILY_CAP_FALLBACKS.plus.mashq) {
  const t = planCopy(lang);
  const isPremium = plan.tier === 'premium';
  if (!isPremium) {
    return {
      ...plan,
      name: t.freeName, // final-5 B7: localised plan name
      offlineEnabled: false,
      priceMonthly: 0,
      priceUzs: 0,
      currency: 'UZS' as const,
      priceLabel: t.free,
      priceUnit: '',
      popular: false,
      // wlive: shown limits = enforced caps (payments-02 plan-caps), never the raw row.
      aiDailyQuota: freeQuota,
      quizDailyQuota: freeQuizzes,
      // PAY2-18: the import allowance import-commerce enforces (platform setting importFreeLimits, default 3/day), not the seed row (15).
      importLimit: freeImportsDay ?? plan.importLimit,
      monthlyFreePageLimit: freePages.pages, // final-5 B1 field kept for clients
      mashqPerDay: freeMashq,
      features: [t.lookupsDay(freeQuota), t.quizzesDay(freeMashq), t.importsDay(freeImportsDay ?? plan.importLimit), t.importPages(freePages.pages, freePages.cycle), t.library],
    };
  }
  // Premium = Plus, a 30-day pass (no auto-renew). Field names (incl. priceMonthly) are kept for old clients;
  // priceMonthly now means "price of the 30-day pass". A price < 1000 soʻm (e.g. the live USD "9") is hidden.
  // Kai 6.1a: Plus shows the price checkout charges (plusPassConfig: admin setting > env > 24990/199990), never the stale row (USD "9").
  void plusImports;
  void plusMashq;
  const priceUzs = publicPlanPriceUzs(passPrices?.p30 ?? plan.priceMonthly);
  const priceYearUzs = publicPlanPriceUzs(passPrices?.p365 ?? yearRaw);
  return {
    ...plan,
    name: t.plusName,
    // Plus shares the Free import pool (3 a day, 50 pages a month). The Plus import benefit is 50% off paid imports.
    importLimit: freeImportsDay ?? plan.importLimit,
    monthlyFreePageLimit: freePages.pages,
    offlineEnabled: false,
    priceMonthly: priceUzs,
    priceUzs,
    priceYearUzs,
    priceHidden: priceUzs === null,
    currency: 'UZS' as const,
    priceLabel: priceUzs === null ? null : formatSom(priceUzs, lang),
    priceUnit: t.passUnit,
    periodDays: 30,
    autoRenew: false,
    popular: true,
    aiDailyQuota: plusLookups, // null = no daily lookup cap for Plus (wlive 14:40 API shape)
    quizDailyQuota: plusQuizzes, // WLF-12: enforced cap (platform_settings caps.plus.quizzes), not the plan column
    mashqPerDay: null, // Plus Mashq is never capped
    // Lookups from config (plus.ai_lookup_quota, null = no daily limit); never "unlimited" in copy.
    // Marketing §4/§7 (14:20): quiz bullet added; quiz cap = plan.quizDailyQuota.
    features: [t.plusLookups(plusLookups, freeQuota), t.plusQuizzes(null, freeMashq), t.plusChapters(plusQuizzes, freeQuizzes), t.plusImportOff, t.plusFree],
  };
}

/** PAY2-18: Free imports a day = admin Import & Pricing → importFreeLimits.dailyFreeImportsPerUser (default 3), as /marketing/plans. */
export const DEFAULT_FREE_IMPORTS_PER_DAY = 3;
export async function freeImportsPerDay(prisma: { platformSetting: { findUnique(a: { where: { key: string } }): Promise<{ value: unknown } | null> } }): Promise<number> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } }).catch(() => null);
  const v = row?.value && typeof row.value === 'object' ? (row.value as { dailyFreeImportsPerUser?: unknown }).dailyFreeImportsPerUser : undefined;
  const n = Math.floor(Number(v ?? DEFAULT_FREE_IMPORTS_PER_DAY));
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_IMPORTS_PER_DAY;
}

/** Kai/Sarvarbek 2026-10-31: Free = 3 imports a day AND 50 pages a month (importFreeLimits.monthlyFreePageLimit / resetCycle). */
export type FreeImportPages = { pages: number; cycle: 'daily' | 'monthly' | 'yearly' };
export const DEFAULT_FREE_IMPORT_PAGES: FreeImportPages = { pages: 50, cycle: 'monthly' };
export async function freeImportPages(prisma: { platformSetting: { findUnique(a: { where: { key: string } }): Promise<{ value: unknown } | null> } }): Promise<FreeImportPages> {
  const row = await prisma.platformSetting.findUnique({ where: { key: 'importFreeLimits' } }).catch(() => null);
  const v = (row?.value && typeof row.value === 'object' ? row.value : {}) as { monthlyFreePageLimit?: unknown; resetCycle?: unknown };
  const n = Math.floor(Number(v.monthlyFreePageLimit ?? DEFAULT_FREE_IMPORT_PAGES.pages));
  // WLF-37: the page pool is monthly by product decision (daily is the 3-imports cap); a stale 'daily' reads as monthly.
  const cycle = v.resetCycle === 'yearly' ? 'yearly' : 'monthly';
  return { pages: Number.isFinite(n) && n >= 0 ? n : DEFAULT_FREE_IMPORT_PAGES.pages, cycle };
}

/** Kai 6.1a: the Plus pass prices checkout charges (same source as import-commerce plusConfig). */
export type PlusPassPrices = { p30: number; p365: number };
type SettingsReader = { platformSetting: { findUnique(a: { where: { key: string } }): Promise<{ value: unknown } | null> } };
export async function plusPassPrices(prisma: SettingsReader): Promise<PlusPassPrices> {
  const get = (key: string) => prisma.platformSetting.findUnique({ where: { key } }).then((r) => r?.value, () => undefined);
  const [p30, p365] = await Promise.all([get(PLUS_SETTING_KEYS.price30), get(PLUS_SETTING_KEYS.price365)]);
  const cfg = plusPassConfig(process.env, 0, { [PLUS_SETTING_KEYS.price30]: p30, [PLUS_SETTING_KEYS.price365]: p365 });
  const of = (d: number) => cfg.plans.find((x) => x.days === d)?.priceUzs ?? 0;
  return { p30: of(30), p365: of(365) };
}
/** Plan cards for /billing/plans (and the Plus card on /marketing/plans). */
let plusMashqCapCleared = false;
export async function buildPlanCards(prisma: PrismaService, lang: PlanLang = 'en') {
  if (!plusMashqCapCleared) {
    plusMashqCapCleared = true;
    await prisma.platformSetting.deleteMany?.({ where: { key: DAILY_CAP_KEYS.plusMashq } })?.catch(() => { plusMashqCapCleared = false; });
  }
  const [plans, caps, freeImports, freePages, plusImports, passPrices] = await Promise.all([
    prisma.subscriptionPlan.findMany({ orderBy: { tier: 'asc' } }),
    getPlanCaps(prisma),
    freeImportsPerDay(prisma), freeImportPages(prisma), plusImportLimits(prisma), plusPassPrices(prisma),
  ]);
  return plans.map((p) => enrichPlan(p, lang, undefined, caps.free.lookups, caps.free.quizzes, caps.plus.lookups, freeImports, caps.plus.quizzes, freePages, plusImports, passPrices, caps.free.mashq, caps.plus.mashq));
}

/** Plus has no separate free-import pool. Stored plusDailyImportsPerUser / plusMonthlyPageLimit are ignored; the public numbers are the Free pool. */
export type PlusImportLimits = { imports: number; pages: number; cycle: FreeImportPages['cycle'] };
export async function plusImportLimits(prisma: { platformSetting: { findUnique(a: { where: { key: string } }): Promise<{ value: unknown } | null> } }): Promise<PlusImportLimits> {
  const [freeDay, freePages] = await Promise.all([freeImportsPerDay(prisma), freeImportPages(prisma)]);
  return { imports: freeDay, pages: freePages.pages, cycle: freePages.cycle };
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private importCommerce: ImportCommerceService,
    private pricing: PricingService,
  ) {}

  /** No prices in code: everything comes from subscription_plans (PRICING.md seed, admin-edited). */
  /** wlive behaviour kept: localized plan cards (enrichPlan) with the enforced payments-02 caps. */
  async listPlans(lang: PricingLang = 'en') {
    return buildPlanCards(this.prisma, lang as PlanLang);
  }

  async getSubscription(userId: string) {
    const ui = await this.prisma.user.findUnique({ where: { id: userId }, select: { uiLanguage: true } });
    const lang: PlanLang = ui?.uiLanguage === 'ru' || ui?.uiLanguage === 'uz' ? ui.uiLanguage : 'en';
    const sub = await this.prisma.userSubscription.findFirst({
      where: { userId, ...activeSubWhere(), plan: { tier: 'premium' } },
      include: { plan: true },
      orderBy: { currentPeriodEnd: 'desc' },
    });

    const benefits = await this.prisma.platformSetting.findUnique({ where: { key: PLUS_SETTING_KEYS.benefits } }).catch(() => null);
    const importDiscountPct = plusPassConfig(process.env, 500, { [PLUS_SETTING_KEYS.benefits]: benefits?.value }).benefits.importDiscountPct;
    const [usage, caps, plan, importAllowance] = await Promise.all([
      this.prisma.aiUsageDaily.findUnique({
        where: { userId_usageDate: { userId, usageDate: usageDayStart() } },
      }),
      getPlanCaps(this.prisma),
      userCapPlan(this.prisma, userId),
      this.importCommerce.learnerAllowance(userId),
    ]);
    const quota = caps[plan].lookups;

    return {
      subscription: sub ? { ...sub, plan: enrichPlan(sub.plan, lang, undefined, caps.free.lookups, caps.free.quizzes, caps.plus.lookups, await freeImportsPerDay(this.prisma), caps.plus.quizzes, await freeImportPages(this.prisma), await plusImportLimits(this.prisma), await plusPassPrices(this.prisma), caps.free.mashq, caps.plus.mashq) } : null,
      usage: {
        lookupsToday: usage?.lookupCount ?? 0,
        quizzesToday: usage?.quizCount ?? 0,
        quota,
        quizQuota: caps[plan].quizzes,
        mashqToday: usage?.mashqQuestionCount ?? 0,
        mashqQuota: caps[plan].mashq,
        resetAt: usageResetAt().toISOString(),
        importAllowance,
        importDiscountPct,
      },
    };
  }
}
