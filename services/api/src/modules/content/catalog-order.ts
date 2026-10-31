import type { Prisma } from '@prisma/client';

/** Catalog sort (web-launch P0): beginner-first by default. CefrLevel enum order is a1 < a2 < b1 < b2 < c1 < c2,
 * and Postgres sorts enum columns by declaration order, so `cefrLevel: 'asc'` puts A1/A2 first. */
export type CatalogSort = 'level' | 'newest';
export const CATALOG_SORTS: CatalogSort[] = ['level', 'newest'];
const LEVEL_RANK: Record<string, number> = { a1: 0, a2: 1, b1: 2, b2: 3, c1: 4, c2: 5 };

export function catalogOrderBy(sort: CatalogSort = 'level'): Prisma.ContentItemOrderByWithRelationInput[] {
  return sort === 'newest'
    ? [{ publishedAt: 'desc' }, { id: 'asc' }]
    : [{ cefrLevel: 'asc' }, { publishedAt: 'desc' }, { id: 'asc' }];
}

/** Same order for in-memory lists (dev feed). Stable. */
export function sortByCatalogOrder<T extends { cefrLevel?: string | null; publishedAt?: string | Date | null }>(
  items: T[],
  sort: CatalogSort = 'level',
): T[] {
  const t = (d: T['publishedAt']) => (d ? new Date(d).getTime() : 0);
  return items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => {
      if (sort === 'level') {
        const r = (LEVEL_RANK[a.it.cefrLevel ?? ''] ?? 9) - (LEVEL_RANK[b.it.cefrLevel ?? ''] ?? 9);
        if (r) return r;
      }
      return t(b.it.publishedAt) - t(a.it.publishedAt) || a.i - b.i;
    })
    .map((x) => x.it);
}
