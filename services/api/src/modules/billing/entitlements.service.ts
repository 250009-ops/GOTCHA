import { Injectable } from '@nestjs/common';
import { EntitlementKind, EntitlementStatus, ImportPaymentStatus, PurchaseSource, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Unified entitlements: one ledger (`entitlements`) for unlocks from Atmos (web), Google Play (Android) and admin
 * grants. Existing access checks keep reading their projections (user_subscriptions, content_purchases,
 * import_payments); this service keeps those in sync and serves GET /billing/entitlements for every client at login.
 */
@Injectable()
export class EntitlementsService {
  constructor(private prisma: PrismaService) {}

  /** Expire lapsed rows, then return what the user owns, regardless of where it was bought. */
  async forUser(userId: string) {
    const now = new Date();
    const expired = await this.prisma.entitlement.updateMany({
      where: { userId, status: EntitlementStatus.active, expiresAt: { lt: now } },
      data: { status: EntitlementStatus.expired },
    });
    if (expired.count > 0) await this.syncPlus(userId);
    const rows = await this.prisma.entitlement.findMany({
      where: { userId, status: EntitlementStatus.active },
      orderBy: { createdAt: 'asc' },
    });
    const plus = rows.filter((r) => r.kind === EntitlementKind.plus);
    const credits = rows.filter((r) => r.kind === EntitlementKind.import_credit && r.importPaymentId);
    const unused = credits.length
      ? new Set(
          (await this.prisma.importPayment.findMany({
            where: { id: { in: credits.map((c) => c.importPaymentId!) }, status: ImportPaymentStatus.paid, userImportId: null },
            select: { id: true },
          })).map((p) => p.id),
        )
      : new Set<string>();
    const latest = plus.reduce<(typeof plus)[number] | null>((a, b) => (!a || (b.expiresAt ?? new Date(8.64e15)) > (a.expiresAt ?? new Date(8.64e15)) ? b : a), null);
    return {
      plus: { active: plus.length > 0, source: latest?.source ?? null, expiresAt: latest?.expiresAt ?? null, sku: latest?.sku ?? null },
      books: rows.filter((r) => r.kind === EntitlementKind.catalog_book && r.contentId).map((r) => ({ contentId: r.contentId!, source: r.source })),
      importCredits: credits.map((c) => ({ paymentId: c.importPaymentId!, source: c.source, used: !unused.has(c.importPaymentId!) })),
    };
  }

  /**
   * Project active `plus` entitlements onto user_subscriptions (what quotas read). Only rows this service owns
   * (provider google_play / atmos_plus) are touched, so admin/dev grants are never cancelled here.
   */
  async syncPlus(userId: string) {
    const now = new Date();
    const active = await this.prisma.entitlement.findMany({
      where: { userId, kind: EntitlementKind.plus, status: EntitlementStatus.active, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    });
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { tier: SubscriptionTier.premium } });
    if (!plan) return;
    const play = active.find((e) => e.source === PurchaseSource.google_play);
    const existing = await this.prisma.userSubscription.findFirst({ where: { userId, provider: 'google_play' }, orderBy: { createdAt: 'desc' } });
    if (play) {
      const periodEnd = active.filter((e) => e.source === PurchaseSource.google_play).reduce<Date | null>((m, e) => (e.expiresAt && (!m || e.expiresAt > m) ? e.expiresAt : m), null);
      if (existing) {
        await this.prisma.userSubscription.update({ where: { id: existing.id }, data: { status: SubscriptionStatus.active, currentPeriodEnd: periodEnd, providerRef: play.sourceRef, planId: plan.id } });
      } else {
        await this.prisma.userSubscription.create({ data: { userId, planId: plan.id, status: SubscriptionStatus.active, currentPeriodEnd: periodEnd, provider: 'google_play', providerRef: play.sourceRef } });
      }
    } else if (existing && existing.status === SubscriptionStatus.active) {
      await this.prisma.userSubscription.update({ where: { id: existing.id }, data: { status: SubscriptionStatus.canceled } });
    }
  }
}
