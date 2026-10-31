import { ContentSource, ContentType, PurchaseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const CATALOG_PAYMENT_PREFIX = 'catalog:';

export type CatalogPricedItem = {
  id: string;
  isFree: boolean;
  priceUsd?: unknown;
  contentSource?: string | null;
  contentType?: string | null;
  createdById?: string | null;
};

export function catalogContentIdFromFormat(contentFormat: string | null | undefined): string | null {
  if (!contentFormat?.startsWith(CATALOG_PAYMENT_PREFIX)) return null;
  const id = contentFormat.slice(CATALOG_PAYMENT_PREFIX.length).trim();
  return id || null;
}

export function catalogPaymentFormat(contentId: string) {
  return `${CATALOG_PAYMENT_PREFIX}${contentId}`;
}

export function catalogPriceUzs(item: Pick<CatalogPricedItem, 'isFree' | 'priceUsd'>): number {
  if (item.isFree) return 0;
  const n = Number(item.priceUsd ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function isUserOwnedImport(item: Pick<CatalogPricedItem, 'contentSource' | 'contentType'>): boolean {
  return item.contentSource === ContentSource.user_import || item.contentType === ContentType.user_import;
}

/** Catalog store items that admin marked paid with a soʻm price. User imports are never charged again. */
export function requiresCatalogPayment(item: CatalogPricedItem): boolean {
  if (isUserOwnedImport(item)) return false;
  return catalogPriceUzs(item) > 0;
}

export async function paidCatalogIds(
  prisma: PrismaService,
  userId: string | undefined,
  contentIds: string[],
): Promise<Set<string>> {
  if (!userId || contentIds.length === 0) return new Set();
  const rows = await prisma.contentPurchase.findMany({
    where: { userId, contentId: { in: contentIds }, status: PurchaseStatus.completed },
    select: { contentId: true },
  });
  return new Set(rows.map((r) => r.contentId));
}

export function catalogAccessGranted(opts: {
  item: CatalogPricedItem;
  userId?: string;
  isAdmin?: boolean;
  purchasedIds: Set<string>;
}): boolean {
  if (opts.isAdmin) return true;
  if (!requiresCatalogPayment(opts.item)) return true;
  if (opts.userId && opts.item.createdById === opts.userId) return true;
  return opts.purchasedIds.has(opts.item.id);
}

/** First chapter, capped so learners can trial-read paid catalog books. */
export const CATALOG_TRIAL_MAX_SEGMENTS = 3;

export function catalogTrialSegmentCount(
  outline: Array<{ chapterIndex?: number | null }>,
): number {
  if (!outline.length) return 0;
  const firstChapter = outline[0]?.chapterIndex ?? 0;
  let count = 0;
  for (const row of outline) {
    if ((row.chapterIndex ?? 0) !== firstChapter) break;
    count += 1;
    if (count >= CATALOG_TRIAL_MAX_SEGMENTS) break;
  }
  return count;
}
