import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EntitlementKind, EntitlementStatus, ImportPaymentStatus, ImportType, Prisma, PurchaseSource, PurchaseStatus, StorePlatform, StoreProductKind } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { catalogPaymentFormat } from '../content/catalog-access';
import { EntitlementsService } from './entitlements.service';
import { GooglePlayClient } from './google-play.client';
import { ImportCommerceService, type ImportQuoteInput } from './import-commerce.service';

/** The value the app passes as BillingFlowParams.setObfuscatedAccountId; binds a Play purchase to one Gotcha account. */
export function playAccountId(userId: string): string {
  return createHash('sha256').update(`gotcha:${userId}`).digest('hex').slice(0, 64);
}

const tokenHash = (t: string) => createHash('sha256').update(t).digest('hex');

const ACTIVE_SUB_STATES = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED']);

export interface VerifyPlayPurchaseInput {
  sku: string;
  purchaseToken: string;
  /** Import tiers: the same quote inputs the import screen used; the SKU must match the quoted tier. */
  importQuote?: ImportQuoteInput;
}

@Injectable()
export class PlayBillingService {
  private readonly log = new Logger(PlayBillingService.name);

  constructor(
    private prisma: PrismaService,
    private play: GooglePlayClient,
    private entitlements: EntitlementsService,
    private commerce: ImportCommerceService,
  ) {}

  /** Active Play SKUs the app should query with BillingClient.queryProductDetails. */
  async storeProducts(platform: StorePlatform) {
    const rows = await this.prisma.storeProduct.findMany({ where: { platform, active: true }, orderBy: [{ kind: 'asc' }, { priceUzs: 'asc' }] });
    return rows.map((r) => ({ sku: r.sku, kind: r.kind, planTier: r.planTier, importTierId: r.importTierId, contentId: r.contentId, priceUzs: r.priceUzs }));
  }

  async skuForBook(contentId: string) {
    const r = await this.prisma.storeProduct.findFirst({ where: { platform: StorePlatform.google_play, kind: StoreProductKind.catalog_book, contentId, active: true } });
    return r ? { sku: r.sku, priceUzs: r.priceUzs } : null;
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

    if (product.kind === StoreProductKind.subscription) return this.verifySubscription(userId, product, input, hash);
    return this.verifyOneTime(userId, product, input, hash, prior);
  }

  private async verifySubscription(userId: string, product: { sku: string; kind: StoreProductKind }, input: VerifyPlayPurchaseInput, hash: string) {
    const sub = await this.play.getSubscription(input.purchaseToken);
    if (!sub) throw new BadRequestException({ message: 'Purchase not found', code: 'play_not_found' });
    const line = sub.lineItems?.find((l) => l.productId === product.sku);
    if (!line) throw new BadRequestException({ message: 'Token/product mismatch', code: 'play_token_mismatch' });
    this.assertAccount(userId, sub.externalAccountIdentifiers?.obfuscatedExternalAccountId);
    const expiresAt = line.expiryTime ? new Date(line.expiryTime) : null;
    const state = sub.subscriptionState ?? 'UNKNOWN';
    const active = ACTIVE_SUB_STATES.has(state) && (!expiresAt || expiresAt > new Date());
    if (state === 'SUBSCRIPTION_STATE_PENDING') return { status: 'pending' as const, entitlements: await this.entitlements.forUser(userId) };

    await this.prisma.$transaction(async (tx) => {
      await tx.playPurchase.upsert({
        where: { tokenHash: hash },
        create: { tokenHash: hash, purchaseToken: input.purchaseToken, userId, sku: product.sku, kind: product.kind, orderId: sub.latestOrderId, state: playSubState(state), expiryTime: expiresAt, autoRenewing: line.autoRenewingPlan?.autoRenewEnabled ?? null, raw: sub as Prisma.InputJsonValue },
        update: { orderId: sub.latestOrderId, state: playSubState(state), expiryTime: expiresAt, autoRenewing: line.autoRenewingPlan?.autoRenewEnabled ?? null, raw: sub as Prisma.InputJsonValue },
      });
      // An upgrade/resubscribe replaces the linked token's entitlement.
      if (sub.linkedPurchaseToken) {
        await tx.entitlement.updateMany({ where: { source: PurchaseSource.google_play, sourceRef: tokenHash(sub.linkedPurchaseToken), status: EntitlementStatus.active }, data: { status: EntitlementStatus.revoked, revokedReason: 'replaced' } });
      }
      await tx.entitlement.upsert({
        where: { source_sourceRef_kind: { source: PurchaseSource.google_play, sourceRef: hash, kind: EntitlementKind.plus } },
        create: { userId, kind: EntitlementKind.plus, source: PurchaseSource.google_play, sourceRef: hash, sku: product.sku, expiresAt, status: active ? EntitlementStatus.active : EntitlementStatus.expired },
        update: { expiresAt, status: active ? EntitlementStatus.active : EntitlementStatus.expired },
      });
      await tx.auditLog.create({ data: { actorId: userId, action: 'play.subscription.verified', entityType: 'play_purchase', entityId: null, metadata: { sku: product.sku, orderId: sub.latestOrderId ?? null, state } } });
    });
    await this.entitlements.syncPlus(userId);
    if (active && sub.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') {
      // Unacknowledged purchases auto-refund after 3 days; a failed ack is retried on the next verify/RTDN.
      await this.play.acknowledgeSubscription(product.sku, input.purchaseToken).then(() => this.markAck(hash)).catch((e) => this.log.warn(`ack failed: ${e}`));
    }
    return { status: active ? ('granted' as const) : ('expired' as const), entitlements: await this.entitlements.forUser(userId) };
  }

  private async verifyOneTime(
    userId: string,
    product: { sku: string; kind: StoreProductKind; contentId: string | null; importTierId: string | null; priceUzs: number },
    input: VerifyPlayPurchaseInput,
    hash: string,
    prior: { id: string } | null,
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
      if (product.kind === StoreProductKind.catalog_book) {
        if (!product.contentId) throw new BadRequestException({ message: 'Product is not mapped to a book', code: 'play_unmapped_sku' });
        const exists = await this.prisma.contentItem.findUnique({ where: { id: product.contentId }, select: { id: true } });
        if (!exists) throw new NotFoundException('Book not found');
        data = { userId, status: ImportPaymentStatus.paid, importType: ImportType.url, contentFormat: catalogPaymentFormat(product.contentId), estimatedPages: 1, amountTiyins: product.priceUzs * 100, account, provider: 'google_play', providerPaymentId: p.orderId ?? null, paidAt: new Date() };
      } else {
        if (!input.importQuote) throw new BadRequestException({ message: 'importQuote is required for import credits', code: 'play_import_quote_required' });
        const quote = await this.commerce.quote(userId, { ...input.importQuote, promoCode: undefined });
        if (!quote.requiresPayment || quote.tier?.id !== product.importTierId) {
          throw new BadRequestException({ message: 'This product does not match the import size', code: 'play_tier_mismatch' });
        }
        data = { userId, status: ImportPaymentStatus.paid, importType: quote.importType, contentFormat: quote.contentFormat, estimatedPages: quote.estimatedPages, tierId: quote.tier.id, amountTiyins: product.priceUzs * 100, account, provider: 'google_play', providerPaymentId: p.orderId ?? null, paidAt: new Date() };
      }
      try {
        payment = await this.prisma.$transaction(async (tx) => {
          const created = await tx.importPayment.create({ data });
          await tx.playPurchase.upsert({
            where: { tokenHash: hash },
            create: { tokenHash: hash, purchaseToken: input.purchaseToken, userId, sku: product.sku, kind: product.kind, orderId: p.orderId, state: 'purchased', raw: p as Prisma.InputJsonValue },
            update: { state: 'purchased', orderId: p.orderId, raw: p as Prisma.InputJsonValue },
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

    if (p.acknowledgementState !== 1 && product.kind === StoreProductKind.catalog_book) {
      await this.play.acknowledgeProduct(product.sku, input.purchaseToken).then(() => this.markAck(hash)).catch((e) => this.log.warn(`ack failed: ${e}`));
    }
    if (product.kind === StoreProductKind.import_tier && p.consumptionState !== 1) {
      // Consumable: credit is granted server-side, so consume here (also acknowledges) and the SKU can be bought again.
      await this.play.consumeProduct(product.sku, input.purchaseToken)
        .then(() => this.prisma.playPurchase.update({ where: { tokenHash: hash }, data: { consumed: true, acknowledged: true } }))
        .catch((e) => this.log.warn(`consume failed: ${e}`));
    }
    void prior;
    return { status: 'granted' as const, paymentId: payment.id, entitlements: await this.entitlements.forUser(userId) };
  }

  /**
   * Real-time developer notification (Pub/Sub push). The payload only tells us *which* token changed;
   * the state is always re-read from the Play API.
   */
  async handleRtdn(body: { message?: { data?: string; messageId?: string } }) {
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
    // Not yet verified by the app: nothing granted yet; the app's verify call will pick up the current state.
    if (!rec) return { ignored: 'unknown_token' };

    if (n.voidedPurchaseNotification) {
      await this.revoke(rec, 'play_voided');
      return { ok: 'voided' };
    }
    if (rec.kind === StoreProductKind.subscription) {
      await this.verifySubscription(rec.userId, { sku: rec.sku, kind: rec.kind }, { sku: rec.sku, purchaseToken: token }, rec.tokenHash).catch(async (e) => {
        if (e instanceof BadRequestException) await this.revoke(rec, 'play_not_found');
        else throw e; // 5xx → Pub/Sub retries
      });
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
        await tx.entitlement.updateMany({ where: { source: PurchaseSource.google_play, sourceRef: rec.tokenHash, status: EntitlementStatus.active }, data: { status: EntitlementStatus.revoked, revokedReason: reason } });
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
