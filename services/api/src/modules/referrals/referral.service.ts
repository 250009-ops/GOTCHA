import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { formatNotification, normalizeNotificationLocale } from '@gotcha/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { capTotalDiscountTiyins, extendedEnd, plusDiscountTiyins } from '../billing/plus-pass';
import { promoDiscountTiyins } from '../billing/pricing.service';
import { NotificationsService } from '../notifications/notifications.service';
import { normalizeReferralCode } from './capture';
import type { PromoCode } from '@prisma/client';

const KEYS = {
  pct: 'referral.friend_discount_pct',
  days: 'referral.referrer_reward_days',
  cap: 'referral.max_rewards_per_year',
  enabled: 'referral.enabled',
} as const;

const DEFAULTS = { pct: 20, days: 30, cap: 12, enabled: true };
const YEAR_MS = 365 * 86_400_000;

export interface ReferralSettings {
  pct: number;
  days: number;
  cap: number;
  enabled: boolean;
}

export function friendLabel(displayName: string | null | undefined): string {
  const parts = (displayName ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export function referralDiscountLine(locale: string, pct: number): string {
  if (locale === 'ru') return `Скидка по приглашению −${pct}%`;
  if (locale === 'en') return `Referral discount −${pct}%`;
  return `Taklif chegirmasi −${pct}%`;
}

/** The larger of the friend discount and a promo wins. They do not stack. */
export function choosePlusDiscount(input: {
  listTiyins: number;
  referralPct: number | null;
  promo?: Pick<PromoCode, 'percentOff' | 'amountOffUzs'> | null;
  minTiyins: number;
  locale: string;
}): { amountTiyins: number; discountTiyins: number; line: string | null; source: 'referral' | 'promo' | null } {
  const referralOff = input.referralPct && input.referralPct > 0
    ? plusDiscountTiyins(input.listTiyins, input.referralPct, input.minTiyins)
    : 0;
  const promoRaw = input.promo ? promoDiscountTiyins(input.listTiyins, input.promo, input.minTiyins) : 0;
  const promoOff = capTotalDiscountTiyins(input.listTiyins, promoRaw, input.minTiyins);
  if (referralOff <= 0 && promoOff <= 0) {
    return { amountTiyins: input.listTiyins, discountTiyins: 0, line: null, source: null };
  }
  if (referralOff >= promoOff) {
    return {
      amountTiyins: input.listTiyins - referralOff,
      discountTiyins: referralOff,
      line: referralDiscountLine(input.locale, input.referralPct ?? 0),
      source: 'referral',
    };
  }
  return { amountTiyins: input.listTiyins - promoOff, discountTiyins: promoOff, line: null, source: 'promo' };
}

function codeBase(firstName: string): string {
  const letters = firstName.normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const base = (letters || 'GOTCHA').slice(0, 12);
  return base.length >= 4 ? base : `${base}GOTCHA`.slice(0, 4);
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger('Referral');

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async settings(): Promise<ReferralSettings> {
    const rows = await this.prisma.platformSetting.findMany({
      where: { key: { in: Object.values(KEYS) } },
    });
    const map = new Map(rows.map((row) => [row.key, row.value]));
    const num = (key: string, fallback: number) => {
      const value = Number(map.get(key));
      return Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
    };
    const enabledRaw = map.get(KEYS.enabled);
    const enabled = enabledRaw === undefined || enabledRaw === null
      ? DEFAULTS.enabled
      : enabledRaw === true || enabledRaw === 'true' || enabledRaw === 1;
    return {
      pct: Math.min(70, num(KEYS.pct, DEFAULTS.pct)),
      days: num(KEYS.days, DEFAULTS.days),
      cap: num(KEYS.cap, DEFAULTS.cap),
      enabled,
    };
  }

  async ensureCode(userId: string): Promise<string> {
    const existing = await this.prisma.referralCode.findUnique({ where: { userId } });
    if (existing) return existing.code;
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
    const base = codeBase((user?.displayName ?? '').split(/\s+/)[0] || '');
    for (let n = 0; n < 1000; n += 1) {
      const suffix = n === 0 ? '' : String(n);
      const code = `${base.slice(0, 16 - suffix.length)}${suffix}`;
      if (code.length < 4) continue;
      try {
        await this.prisma.referralCode.create({ data: { userId, code } });
        return code;
      } catch (error) {
        const codeErr = (error as { code?: string }).code;
        if (codeErr !== 'P2002') throw error;
      }
    }
    throw new Error('Could not allocate a referral code.');
  }

  async me(userId: string) {
    const [code, settings, rows] = await Promise.all([
      this.ensureCode(userId),
      this.settings(),
      this.prisma.referral.findMany({
        where: { referrerId: userId },
        orderBy: { createdAt: 'desc' },
        include: { referee: { select: { displayName: true } } },
      }),
    ]);
    const username = (process.env.TELEGRAM_BOT_USERNAME || '').replace(/^@/, '').trim();
    const rewarded = rows.filter((row) => row.status === 'rewarded');
    return {
      code,
      webLink: `https://gotchaa.uz/r/${code}`,
      telegramLink: `https://t.me/${username}?start=r_${code}`,
      invited: rows.length,
      paid: rewarded.length,
      daysEarned: rewarded.length * settings.days,
      enabled: settings.enabled,
      friends: rows.map((row) => ({
        name: friendLabel(row.referee.displayName),
        date: row.createdAt.toISOString(),
        status: row.status,
      })),
    };
  }

  /** Public. First name only. */
  async resolve(raw: string) {
    const code = normalizeReferralCode(raw);
    if (!code) throw new NotFoundException('Referral code not found.');
    const settings = await this.settings();
    if (!settings.enabled) throw new NotFoundException('Referral code not found.');
    const row = await this.prisma.referralCode.findUnique({
      where: { code },
      include: { user: { select: { displayName: true } } },
    });
    if (!row) throw new NotFoundException('Referral code not found.');
    const firstName = (row.user.displayName ?? '').trim().split(/\s+/)[0] || '';
    return { firstName };
  }

  /**
   * Attaches a referral to a brand-new account. Self-referral (same user, phone, or Telegram id) is ignored.
   */
  async attachNewUser(input: {
    refereeId: string;
    code?: string | null;
    source: 'web' | 'telegram';
    phone?: string | null;
    telegramId?: bigint | null;
  }) {
    const code = normalizeReferralCode(input.code);
    if (!code) return null;
    const settings = await this.settings();
    if (!settings.enabled) return null;
    const referralCode = await this.prisma.referralCode.findUnique({
      where: { code },
      include: { user: { select: { id: true, phone: true, telegramId: true } } },
    });
    if (!referralCode) return null;
    const referrer = referralCode.user;
    if (referrer.id === input.refereeId) return null;
    if (input.phone && referrer.phone && input.phone === referrer.phone) return null;
    if (input.telegramId != null && referrer.telegramId != null && input.telegramId === referrer.telegramId) return null;
    const existing = await this.prisma.referral.findUnique({ where: { refereeId: input.refereeId } });
    if (existing) return null;
    return this.prisma.referral.create({
      data: {
        referrerId: referrer.id,
        refereeId: input.refereeId,
        code,
        source: input.source,
        status: 'registered',
      },
    });
  }

  async quotePlus(userId: string, listTiyins: number, promo: Pick<PromoCode, 'percentOff' | 'amountOffUzs'> | null, minTiyins: number) {
    const [settings, user, eligiblePct] = await Promise.all([
      this.settings(),
      this.prisma.user.findUnique({ where: { id: userId }, select: { uiLanguage: true } }),
      this.eligiblePct(userId),
    ]);
    return choosePlusDiscount({
      listTiyins,
      referralPct: settings.enabled ? eligiblePct : null,
      promo,
      minTiyins,
      locale: normalizeNotificationLocale(user?.uiLanguage),
    });
  }

  /** Friend discount applies only before the referee's first paid Plus. */
  async eligiblePct(userId: string): Promise<number | null> {
    const settings = await this.settings();
    if (!settings.enabled || settings.pct <= 0) return null;
    const referral = await this.prisma.referral.findUnique({ where: { refereeId: userId } });
    if (!referral || referral.status !== 'registered') return null;
    const paid = await this.prisma.importPayment.count({
      where: { userId, status: 'paid', contentFormat: { startsWith: 'plus_pass:' } },
    });
    if (paid > 0) return null;
    return settings.pct;
  }

  /** First paid Plus for the referee extends the referrer's Plus once, inside the yearly cap. */
  async onRefereePlusPaid(payment: { id: string; userId: string }) {
    const referral = await this.prisma.referral.findUnique({ where: { refereeId: payment.userId } });
    if (!referral || referral.status !== 'registered') return;
    const paid = await this.prisma.importPayment.count({
      where: { userId: payment.userId, status: 'paid', contentFormat: { startsWith: 'plus_pass:' } },
    });
    if (paid > 1) return;
    const settings = await this.settings();
    if (!settings.enabled) return;
    const since = new Date(Date.now() - YEAR_MS);
    const granted = await this.prisma.referral.count({
      where: { referrerId: referral.referrerId, status: 'rewarded', rewardedAt: { gte: since } },
    });
    if (granted >= settings.cap) {
      this.logger.warn(`referral ${referral.id} not rewarded: yearly cap ${settings.cap}`);
      await this.prisma.auditLog.create({
        data: {
          action: 'referral.cap',
          entityType: 'referral',
          entityId: referral.id,
          metadata: { paymentId: payment.id, referrerId: referral.referrerId },
        },
      }).catch(() => undefined);
      return;
    }
    const claimed = await this.prisma.referral.updateMany({
      where: { id: referral.id, status: 'registered' },
      data: { status: 'rewarded', rewardPaymentId: payment.id, rewardedAt: new Date() },
    });
    if (claimed.count !== 1) return;
    await this.extendPlus(referral.referrerId, settings.days, referral.id);
    await this.notifyReward(referral.referrerId, settings.days, referral.id);
  }

  /** Refund voids the referral. Days already granted stay; the event is logged for an admin. */
  async onPlusRefunded(payment: { id: string; userId: string }) {
    const referral = await this.prisma.referral.findFirst({
      where: { refereeId: payment.userId, status: { in: ['registered', 'rewarded'] } },
    });
    if (!referral) return;
    if (referral.status === 'rewarded' && referral.rewardPaymentId && referral.rewardPaymentId !== payment.id) return;
    await this.prisma.referral.update({ where: { id: referral.id }, data: { status: 'void' } });
    this.logger.warn(`referral ${referral.id} void after refund of payment ${payment.id}; Plus days were not removed`);
    await this.prisma.auditLog.create({
      data: {
        action: 'referral.void',
        entityType: 'referral',
        entityId: referral.id,
        metadata: { paymentId: payment.id, daysNotRemoved: true },
      },
    }).catch(() => undefined);
  }

  private async extendPlus(userId: string, days: number, referralId: string) {
    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const current = await tx.entitlement.findFirst({
        where: { userId, kind: 'plus', status: 'active', expiresAt: { gt: now } },
        orderBy: { expiresAt: 'desc' },
      });
      const expiresAt = extendedEnd(current?.expiresAt, days, now);
      const startsAt = current?.expiresAt && current.expiresAt > now ? current.expiresAt : now;
      await tx.entitlement.create({
        data: {
          userId,
          kind: 'plus',
          source: 'admin',
          sourceRef: `referral:${referralId}`,
          sku: 'plus_referral',
          status: 'active',
          startsAt,
          expiresAt,
        },
      });
      const plan = await tx.subscriptionPlan.findUnique({ where: { tier: 'premium' } });
      if (!plan) return;
      await tx.userSubscription.create({
        data: {
          userId,
          planId: plan.id,
          status: 'active',
          currentPeriodEnd: expiresAt,
          provider: 'admin',
          providerRef: `referral:${referralId}`,
        },
      });
    });
  }

  private async notifyReward(userId: string, days: number, referralId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { uiLanguage: true } });
    const locale = normalizeNotificationLocale(user?.uiLanguage);
    const text = formatNotification(locale, 'referral', { rewardDays: days });
    await this.notifications.push(userId, {
      kind: 'referral',
      title: text.title,
      body: text.body,
      href: 'referral',
      refId: referralId,
      dedupeKey: `referral:${referralId}`,
    });
  }
}
