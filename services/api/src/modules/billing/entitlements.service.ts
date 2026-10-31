import { Injectable } from '@nestjs/common';
import { EntitlementKind, EntitlementStatus, ImportPaymentStatus, PurchaseSource, SubscriptionStatus, SubscriptionTier } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { laterEnd } from './plus-pass';

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

  async syncPlus(userId: string) {
    await projectPlus(this.prisma, userId);
  }
}

/**
 * Project active `plus` entitlements (Play subs and web passes) onto user_subscriptions, which quotas read.
 * Overlap rule: the LATER end date wins. Only rows this projection owns (provider google_play / atmos) are touched,
 * so admin/dev grants are never cancelled here. Expired/revoked entitlements (refund) drop Plus immediately.
 */
export async function projectPlus(prisma: PrismaService, userId: string) {
  const now = new Date();
  const active = await prisma.entitlement.findMany({
    where: { userId, kind: EntitlementKind.plus, status: EntitlementStatus.active, source: { in: [PurchaseSource.google_play, PurchaseSource.atmos] }, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
  });
  const plan = await prisma.subscriptionPlan.findUnique({ where: { tier: SubscriptionTier.premium } });
  if (!plan) return;
  const existing = await prisma.userSubscription.findFirst({ where: { userId, provider: { in: ['google_play', 'atmos'] } }, orderBy: { createdAt: 'desc' } });
  if (active.length) {
    const end = (e: { expiresAt: Date | null }) => (e.expiresAt ? e.expiresAt.getTime() : Number.POSITIVE_INFINITY);
    const winner = active.reduce((a, b) => (end(b) > end(a) ? b : a));
    const periodEnd = active.reduce<Date | null | undefined>((m, e) => (m === undefined ? e.expiresAt : laterEnd(m, e.expiresAt)), undefined) ?? null;
    const data = { status: SubscriptionStatus.active, currentPeriodEnd: periodEnd, provider: winner.source === PurchaseSource.atmos ? 'atmos' : 'google_play', providerRef: winner.sourceRef, planId: plan.id };
    if (existing) await prisma.userSubscription.update({ where: { id: existing.id }, data });
    else await prisma.userSubscription.create({ data: { userId, ...data } });
  } else if (existing && existing.status === SubscriptionStatus.active) {
    await prisma.userSubscription.update({ where: { id: existing.id }, data: { status: SubscriptionStatus.canceled, currentPeriodEnd: now } });
  }
}
