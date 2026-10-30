import { BadRequestException, ConflictException, ForbiddenException, HttpException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from '@nestjs/common';
import { EntitlementKind, EntitlementStatus, ImportPaymentStatus, ImportType, Prisma, PublishStatus, PurchaseSource, PurchaseStatus, StorePlatform, StoreProductKind } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { catalogPaymentFormat } from '../content/catalog-access';
import { EntitlementsService } from './entitlements.service';
import { GooglePlayClient, openToken, sealToken } from './google-play.client';
import { ImportCommerceService, type ImportQuoteInput } from './import-commerce.service';

/**
 * The value the app passes as BillingFlowParams.setObfuscatedAccountId; binds a Play purchase to one Gotcha
 * account. Optional server pepper (PLAY_ACCOUNT_PEPPER) makes it unguessable from user ids; changing the pepper
 * after launch orphans bindings, so set it once before the first real purchase.
 */
export function playAccountId(userId: string): string {
  const pepper = process.env.PLAY_ACCOUNT_PEPPER?.trim() ?? '';
  return createHash('sha256').update(`gotcha:${pepper}${userId}`).digest('hex').slice(0, 64);
}

const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');

/**
 * Active = Plus granted. ON_HOLD (payment failed after grace) and PAUSED (user paused) are deliberately
 * NOT active: Plus is withheld until Play reports ACTIVE again via RTDN or the refresh job (PM2).
 */
const ACTIVE_SUB_STATES = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);

const DAY = 86_400_000;
export const PLAY_JOB_INTERVAL_MS = 15 * 60_000;

export interface VerifyPlayPurchaseInput {
  sku: string;
  purchaseToken: string;
  /** Optional for import tiers (PB2): only the import type is taken from it; the credit is bound at import time. */
  importQuote?: ImportQuoteInput;
}

@Injectable()
export class PlayBillingService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PlayBillingService.name);
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private prisma: PrismaService,
    private play: GooglePlayClient,
    private entitlements: EntitlementsService,
    private commerce: ImportCommerceService,
  ) {}

  onModuleInit() {
    if (!this.play.configured() || process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.runJobs().catch((e) => this.log.error(`play jobs: ${e}`)), PLAY_JOB_INTERVAL_MS);
    this.timer.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Active Play SKUs the app should query with BillingClient.queryProductDetails. */
  async storeProducts(platform: StorePlatform) {
    const rows = await this.prisma.storeProduct.findMany({ where: { platform, active: true }, orderBy: [{ kind: 'asc' }, { priceUzs: 'asc' }] });
    return rows.map((r) => ({ sku: r.sku, kind: r.kind, planTier: r.planTier, importTierId: r.importTierId, contentId: r.contentId, priceUzs: r.priceUzs }));
  }

  /** m-p2-8: only published books expose a SKU. */
  async skuForBook(contentId: string) {
    const r = await this.prisma.storeProduct.findFirst({ where: { platform: StorePlatform.google_play, kind: StoreProductKind.catalog_book, contentId, active: true } });
    if (!r) return null;
    const book = await this.prisma.contentItem.findUnique({ where: { id: contentId }, select: { publishStatus: true } });
    return book?.publishStatus === PublishStatus.published ? { sku: r.sku, priceUzs: r.priceUzs } : null;
  }

  /**
   * Verify a purchase token with the Play Developer API (never the client's word), bind it to this account,
   * grant the unlock exactly once, then acknowledge (or consume, for import credits). Idempotent per token.
   */
  async verify(userId: string, input: VerifyPlayPurchaseInput) {
    const product = await this.prisma.storeProduct.findUnique({ where: { platform_sku: { platform: StorePlatform.google_play, sku: input.sku } } });
    if (!product || !product.active) throw new BadRequestException({ message: 'Unknown product', code: 'play_unknown_sku' });
    const hash = tokenHash(input.purchaseToken);
    const prior = await this.prisma.playPurchase.findUnique({ where: { tokenHash: hash } });
    if (prior && prior.userId !== userId) {
      throw new ConflictException({ message: 'This purchase belongs to another account', code: 'play_purchase_other_account' });
    }
    if (prior && prior.sku !== input.sku) throw new BadRequestException({ message: 'Token/product mismatch', code: 'play_token_mismatch' });

    if (product.kind === StoreProductKind.subscription) return this.verifySubscription(userId, product, input.purchaseToken, hash);
    return this.verifyOneTime(userId, product, input, hash);
  }

  private async verifySubscription(userId: string, product: { sku: string; kind: StoreProductKind }, token: string, hash: string) {
    const sub = await this.play.getSubscription(token);
    if (!sub) throw new BadRequestException({ message: 'Purchase not found', code: 'play_not_found' });
    const line = sub.lineItems?.find((l) => l.productId === product.sku);
    if (!line) throw new BadRequestException({ message: 'Token/product mismatch', code: 'play_token_mismatch' });
    this.assertAccount(userId, sub.externalAccountIdentifiers?.obfuscatedExternalAccountId);
    const expiresAt = line.expiryTime ? new Date(line.expiryTime) : null;
    const state = sub.subscriptionState ?? 'UNKNOWN';
    const active = ACTIVE_SUB_STATES.has(state) && (!expiresAt || expiresAt > new Date());
    if (state === 'SUBSCRIPTION_STATE_PENDING') return { status: 'pending' as const, entitlements: await this.entitlements.forUser(userId) };

    const linkedHash = sub.linkedPurchaseToken ? tokenHash(sub.linkedPurchaseToken) : null;
    await this.prisma.$transaction(async (tx) => {
      const before = await tx.playPurchase.findUnique({ where: { tokenHash: hash } });
      const prevOrderId = before?.orderId ?? null;
      const prevState = before?.state ?? null;
      await tx.playPurchase.upsert({
        where: { tokenHash: hash },
        create: { tokenHash: hash, purchaseToken: sealToken(token), userId, sku: product.sku, kind: product.kind, orderId: sub.latestOrderId, state: playSubState(state), expiryTime: expiresAt, autoRenewing: line.autoRenewingPlan?.autoRenewEnabled ?? null, linkedTokenHash: linkedHash, lastCheckedAt: new Date(), raw: sub as Prisma.InputJsonValue },
        update: { orderId: sub.latestOrderId, state: prevState === 'revoked' && prevOrderId === sub.latestOrderId ? 'revoked' : playSubState(state), expiryTime: expiresAt, autoRenewing: line.autoRenewingPlan?.autoRenewEnabled ?? null, linkedTokenHash: linkedHash, lastCheckedAt: new Date(), raw: sub as Prisma.InputJsonValue },
      });
      // PM5: an upgrade/resubscribe replaces the linked token's entitlement, for THIS user only.
      if (linkedHash) {
        await tx.entitlement.updateMany({ where: { userId, source: PurchaseSource.google_play, sourceRef: linkedHash, kind: EntitlementKind.plus, status: EntitlementStatus.active }, data: { status: EntitlementStatus.revoked, revokedReason: 'replaced' } });
      }
      const existing = await tx.entitlement.findUnique({ where: { source_sourceRef_kind: { source: PurchaseSource.google_play, sourceRef: hash, kind: EntitlementKind.plus } } });
      // PM6: a revoked (voided / charged-back) entitlement only comes back with a NEW order (a real renewal).
      const stayRevoked = existing?.status === EntitlementStatus.revoked && (!sub.latestOrderId || prevOrderId === sub.latestOrderId);
      const status = stayRevoked ? EntitlementStatus.revoked : active ? EntitlementStatus.active : EntitlementStatus.expired;
      await tx.entitlement.upsert({
        where: { source_sourceRef_kind: { source: PurchaseSource.google_play, sourceRef: hash, kind: EntitlementKind.plus } },
        create: { userId, kind: EntitlementKind.plus, source: PurchaseSource.google_play, sourceRef: hash, sku: product.sku, expiresAt, status },
        update: stayRevoked ? { expiresAt } : { expiresAt, status, revokedReason: null },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'play.subscription.verified', entityType: 'play_purchase', entityId: null, metadata: { sku: product.sku, orderId: sub.latestOrderId ?? null, state, stayRevoked } } });
    });
    await this.entitlements.syncPlus(userId);
    if (active && sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
      // Unacknowledged purchases auto-refund after 3 days; failures are retried by runJobs (PM1).
      await this.play.acknowledgeSubscription(product.sku, token).then(() => this.markAck(hash)).catch((e) => this.log.warn(`ack failed: ${e}`));
    } else if (sub.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
      await this.markAck(hash).catch(() => undefined);
    }
    const ent = await this.entitlements.forUser(userId);
    return { status: ent.plus.active ? ('granted' as const) : ('expired' as const), entitlements: ent };
  }

  private async verifyOneTime(
    userId: string,
    product: { sku: string; kind: StoreProductKind; contentId: string | null; importTierId: string | null; priceUzs: number },
    input: VerifyPlayPurchaseInput,
    hash: string,
  ) {
    const p = await this.play.getProduct(product.sku, input.purchaseToken);
    if (!p) throw new BadRequestException({ message: 'Purchase not found', code: 'play_not_found' });
    this.assertAccount(userId, p.obfuscatedExternalAccountId);
    if (p.purchaseState === 2) return { status: 'pending' as const, entitlements: await this.entitlements.forUser(userId) };
    if (p.purchaseState !== 0) throw new BadRequestException({ message: 'Purchase was cancelled', code: 'play_cancelled' });

    const account = `gp_${hash.slice(0, 40)}`;
    let payment = await this.prisma.importPayment.findUnique({ where: { account } });
    if (!payment) {
      let data: Prisma.ImportPaymentUncheckedCreateInput;
      // m-p2-3: amountTiyins is the configured store price (an estimate); Play Console is authoritative.
      const base = { userId, status: ImportPaymentStatus.paid, amountTiyins: product.priceUzs * 100, account, provider: 'google_play', providerPaymentId: p.orderId ?? null, paidAt: new Date() };
      if (product.kind === StoreProductKind.catalog_book) {
        if (!product.contentId) throw new BadRequestException({ message: 'Product is not mapped to a book', code: 'play_unmapped_sku' });
        const exists = await this.prisma.contentItem.findUnique({ where: { id: product.contentId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Book not found');
        data = { ...base, importType: ImportType.url, contentFormat: catalogPaymentFormat(product.contentId), estimatedPages: 1 };
      } else {
        // PB2: an import credit for the SKU's page tier. No quote needed; the document is bound and checked
        // against the tier when it is imported (assertPaymentCoversPages).
        const tier = product.importTierId ? await this.prisma.importPageTier.findUnique({ where: { id: product.importTierId } }) : null;
        if (!tier) throw new BadRequestException({ message: 'Product is not mapped to a page tier', code: 'play_unmapped_sku' });
        const importType = input.importQuote?.importType ?? ImportType.pdf;
        data = { ...base, importType, contentFormat: 'ebook', estimatedPages: tier.maxPages ?? tier.minPages, tierId: tier.id };
      }
      try {
        payment = await this.prisma.$transaction(async (tx) => {
          const created = await tx.importPayment.create({ data });
          await tx.playPurchase.upsert({
            where: { tokenHash: hash },
            create: { tokenHash: hash, purchaseToken: sealToken(input.purchaseToken), userId, sku: product.sku, kind: product.kind, orderId: p.orderId, state: 'purchased', lastCheckedAt: new Date(), raw: p as Prisma.InputJsonValue },
            update: { state: 'purchased', orderId: p.orderId, lastCheckedAt: new Date(), raw: p as Prisma.InputJsonValue },
          });
          if (product.kind === StoreProductKind.import_tier) {
            await tx.entitlement.create({ data: { userId, kind: EntitlementKind.import_credit, source: PurchaseSource.google_play, sourceRef: created.id, sku: product.sku, importPaymentId: created.id } });
          }
          await tx.auditLog.create({ data: { actorId: userId, action: 'play.purchase.verified', entityType: 'import_payment', entityId: created.id, metadata: { sku: product.sku, orderId: p.orderId ?? null, kind: product.kind } } });
          return created;
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          payment = await this.prisma.importPayment.findUnique({ where: { account } }); // concurrent verify won
        } else throw e;
      }
    }
    if (!payment) throw new ConflictException('Purchase is being processed, try again');
    if (product.kind === StoreProductKind.catalog_book) await this.commerce.fulfillCatalogPurchase(payment); // idempotent
    await this.settle(product.kind, product.sku, input.purchaseToken, hash, p.acknowledgementState === 1, p.consumptionState === 1);
    return { status: 'granted' as const, paymentId: payment.id, entitlements: await this.entitlements.forUser(userId) };
  }

  /** Acknowledge books / consume import credits. Failures are retried by runJobs (PM1). */
  private async settle(kind: StoreProductKind, sku: string, token: string, hash: string, acked: boolean, consumed: boolean) {
    if (kind === StoreProductKind.catalog_book) {
      if (acked) return this.markAck(hash).catch(() => undefined);
      return this.play.acknowledgeProduct(sku, token).then(() => this.markAck(hash)).catch((e) => this.log.warn(`ack failed: ${e}`));
    }
    if (kind === StoreProductKind.import_tier) {
      if (consumed) return this.prisma.playPurchase.update({ where: { tokenHash: hash }, data: { consumed: true, acknowledged: true } }).catch(() => undefined);
      return this.play.consumeProduct(sku, token)
        .then(() => this.prisma.playPurchase.update({ where: { tokenHash: hash }, data: { consumed: true, acknowledged: true } }))
        .catch((e) => this.log.warn(`consume failed: ${e}`));
    }
  }

  /**
   * Real-time developer notification (Pub/Sub push). The payload only says *which* token changed; state is
   * always re-read from Play, and a void is confirmed against voidedpurchases.list before revoking (PB1).
   * Domain errors are handled (2xx) so Pub/Sub doesn't retry forever; only Play outages (503) are retried (PM4).
   */
  async handleRtdn(body: { message?: { data?: string; messageId?: string; message_id?: string } }) {
    const messageId = body?.message?.messageId ?? body?.message?.message_id;
    if (messageId && (await this.prisma.playRtdnMessage.findUnique({ where: { messageId } }))) return { ignored: 'duplicate' };
    const result = await this.processRtdn(body).catch(async (e) => {
      if (e instanceof ServiceUnavailableException || !(e instanceof HttpException)) throw e; // retry
      await this.prisma.auditLog.create({ data: { actorId: null, action: 'play.rtdn.rejected', entityType: 'play_rtdn', entityId: null, metadata: { messageId: messageId ?? null, error: e.message } } }).catch(() => undefined);
      return { ignored: 'domain_error' };
    });
    if (messageId) {
      await this.prisma.playRtdnMessage.create({ data: { messageId } }).catch(() => undefined);
    }
    return result;
  }

  private async processRtdn(body: { message?: { data?: string } }) {
    const raw = body?.message?.data;
    if (!raw) return { ignored: 'no_data' };
    let n: {
      packageName?: string;
      subscriptionNotification?: { purchaseToken: string; subscriptionId?: string; notificationType: number };
      oneTimeProductNotification?: { purchaseToken: string; sku: string; notificationType: number };
      voidedPurchaseNotification?: { purchaseToken: string; orderId?: string; productType?: number; refundType?: number };
      testNotification?: unknown;
    };
    try {
      n = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    } catch {
      return { ignored: 'bad_json' };
    }
    if (n.packageName !== this.play.packageName()) return { ignored: 'package' };
    if (n.testNotification) return { ok: 'test' };
    const token = n.subscriptionNotification?.purchaseToken ?? n.oneTimeProductNotification?.purchaseToken ?? n.voidedPurchaseNotification?.purchaseToken;
    if (!token) return { ignored: 'no_token' };
    const rec = await this.prisma.playPurchase.findUnique({ where: { tokenHash: tokenHash(token) } });
    // Not yet verified by the app: nothing granted yet; the app's verify call picks up the current state.
    if (!rec) return { ignored: 'unknown_token' };

    if (n.voidedPurchaseNotification) {
      // PB1: never trust the payload. Confirm with Play's voided list (last 30 days) before revoking.
      const voided = await this.play.voidedPurchases(Date.now() - 30 * DAY);
      if (!voided.some((v) => v.purchaseToken === token)) return { ignored: 'void_not_confirmed' };
      await this.revoke(rec, 'play_voided');
      return { ok: 'voided' };
    }
    if (rec.kind === StoreProductKind.subscription) {
      try {
        await this.verifySubscription(rec.userId, { sku: rec.sku, kind: rec.kind }, token, rec.tokenHash);
      } catch (e) {
        if (e instanceof BadRequestException && (e.getResponse() as { code?: string })?.code === 'play_not_found') await this.revoke(rec, 'play_not_found');
        else throw e;
      }
      return { ok: 'subscription' };
    }
    const p = await this.play.getProduct(rec.sku, token);
    if (!p || p.purchaseState === 1) await this.revoke(rec, 'play_cancelled');
    return { ok: 'one_time' };
  }

  /** Refund/void/chargeback: revoke exactly what this token unlocked. Spent import credits are flagged for support. */
  private async revoke(rec: { userId: string; tokenHash: string; kind: StoreProductKind }, reason: string) {
    const account = `gp_${rec.tokenHash.slice(0, 40)}`;
    await this.prisma.$transaction(async (tx) => {
      await tx.playPurchase.update({ where: { tokenHash: rec.tokenHash }, data: { state: 'revoked' } });
      if (rec.kind === StoreProductKind.subscription) {
        await tx.entitlement.updateMany({ where: { userId: rec.userId, source: PurchaseSource.google_play, sourceRef: rec.tokenHash, status: EntitlementStatus.active }, data: { status: EntitlementStatus.revoked, revokedReason: reason } });
        return;
      }
      const pay = await tx.importPayment.findUnique({ where: { account } });
      if (!pay) return;
      const used = !!pay.userImportId;
      await tx.importPayment.updateMany({
        where: { id: pay.id, status: ImportPaymentStatus.paid },
        data: used ? { needsAttention: true, refundReason: reason } : { status: ImportPaymentStatus.refunded, refundReason: reason, refundRequestedAt: new Date() },
      });
      const cp = await tx.contentPurchase.updateMany({ where: { importPaymentId: pay.id, status: PurchaseStatus.completed }, data: { status: PurchaseStatus.refunded } });
      if (cp.count > 0) {
        const contentId = pay.contentFormat.split(':')[1];
        if (contentId) await tx.contentItem.update({ where: { id: contentId }, data: { salesCount: { decrement: cp.count } } }).catch(() => undefined);
      }
      await tx.entitlement.updateMany({ where: { importPaymentId: pay.id, status: EntitlementStatus.active }, data: { status: EntitlementStatus.revoked, revokedReason: reason } });
      await tx.auditLog.create({ data: { actorId: null, action: 'play.purchase.revoked', entityType: 'import_payment', entityId: pay.id, metadata: { reason, creditAlreadyUsed: used } } });
    });
    if (rec.kind === StoreProductKind.subscription) await this.entitlements.syncPlus(rec.userId);
  }

  /**
   * PM2: before a Play Plus entitlement is expired locally, re-read it from Play (at most once per hour per
   * token), so a late or lost SUBSCRIPTION_RENEWED notification doesn't take Plus away.
   */
  async refreshUserSubscriptions(userId: string) {
    const due = await this.prisma.entitlement.findMany({
      where: { userId, kind: EntitlementKind.plus, source: PurchaseSource.google_play, status: EntitlementStatus.active, expiresAt: { lt: new Date() } },
    });
    for (const e of due) await this.refreshSubscription(e.sourceRef, 60 * 60_000);
  }

  private async refreshSubscription(hash: string, minAgeMs: number) {
    const rec = await this.prisma.playPurchase.findUnique({ where: { tokenHash: hash } });
    if (!rec || rec.state === 'revoked') return;
    if (rec.lastCheckedAt && Date.now() - rec.lastCheckedAt.getTime() < minAgeMs) return;
    await this.prisma.playPurchase.update({ where: { tokenHash: hash }, data: { lastCheckedAt: new Date() } });
    await this.verifySubscription(rec.userId, { sku: rec.sku, kind: rec.kind }, openToken(rec.purchaseToken), hash).catch((e) => this.log.warn(`sub refresh: ${e}`));
  }

  /**
   * PM1 + PM2 job (every 15 min):
   *  - retry acknowledge/consume for verified purchases younger than 3 days (Play auto-refunds after 3 days);
   *    rows older than 48 h are logged at ERROR for alerting;
   *  - refresh Play subscriptions expiring within 24 h (6 h minimum between reads);
   *  - drop RTDN message ids older than 7 days.
   */
  async runJobs() {
    const now = Date.now();
    const pending = await this.prisma.playPurchase.findMany({
      where: {
        state: 'purchased',
        createdAt: { gt: new Date(now - 3 * DAY) },
        OR: [{ acknowledged: false }, { kind: StoreProductKind.import_tier, consumed: false }],
      },
      take: 200,
    });
    let settled = 0;
    for (const r of pending) {
      if (now - r.createdAt.getTime() > 2 * DAY) this.log.error(`ALERT play purchase ${r.tokenHash.slice(0, 12)} (${r.sku}) unacknowledged for >48h`);
      const token = openToken(r.purchaseToken);
      if (r.kind === StoreProductKind.subscription) {
        await this.play.acknowledgeSubscription(r.sku, token).then(() => this.markAck(r.tokenHash)).then(() => settled++).catch(() => undefined);
      } else {
        await this.settle(r.kind, r.sku, token, r.tokenHash, r.acknowledged, r.consumed).then(() => settled++);
      }
    }
    const expiring = await this.prisma.playPurchase.findMany({
      where: { kind: StoreProductKind.subscription, state: { not: 'revoked' }, expiryTime: { lt: new Date(now + DAY), gt: new Date(now - 7 * DAY) } },
      take: 200,
    });
    for (const r of expiring) await this.refreshSubscription(r.tokenHash, 6 * 60 * 60_000);
    await this.prisma.playRtdnMessage.deleteMany({ where: { receivedAt: { lt: new Date(now - 7 * DAY) } } });
    return { pending: pending.length, settled, refreshed: expiring.length };
  }

  private assertAccount(userId: string, obfuscated: string | undefined) {
    // The app always sets it; a missing/mismatched id means the token was bought on another Gotcha account.
    if (obfuscated !== playAccountId(userId)) {
      throw new ForbiddenException({ message: 'This purchase belongs to another account', code: 'play_purchase_other_account' });
    }
  }

  private markAck(hash: string) {
    return this.prisma.playPurchase.update({ where: { tokenHash: hash }, data: { acknowledged: true } });
  }
}

function playSubState(s: string): string {
  return ({
    SUBSCRIPTION_STATE_ACTIVE: 'purchased',
    SUBSCRIPTION_STATE_CANCELED: 'canceled',
    SUBSCRIPTION_STATE_IN_GRACE_PERIOD: 'purchased',
    SUBSCRIPTION_STATE_ON_HOLD: 'on_hold',
    SUBSCRIPTION_STATE_PAUSED: 'paused',
    SUBSCRIPTION_STATE_EXPIRED: 'expired',
    SUBSCRIPTION_STATE_PENDING: 'pending',
  } as Record<string, string>)[s] ?? 'unknown';
}
