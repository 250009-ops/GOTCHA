/** Recency timestamp for catalog items (publishedAt preferred). */
export function catalogRecencyMs(item: {
  publishedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): number {
  const pub = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
  const created = item.createdAt ? new Date(item.createdAt).getTime() : 0;
  return Math.max(pub, created);
}

/**
 * Interleave recently-added catalog items by language so "New in the library"
 * shows a balanced mix (RU, EN, UZ, …) instead of one bulk-import language block.
 *
 * Input should already be sorted newest-first globally; buckets preserve per-language order.
 */
export function interleaveByLanguage<T extends { language: string }>(
  items: T[],
  limit = items.length,
): T[] {
  if (items.length <= 1 || limit <= 0) return items.slice(0, Math.max(0, limit));

  const byLang = new Map<string, T[]>();
  for (const item of items) {
    const lang = item.language?.trim().toLowerCase() || 'unknown';
    const bucket = byLang.get(lang) ?? [];
    bucket.push(item);
    byLang.set(lang, bucket);
  }

  if (byLang.size <= 1) return items.slice(0, limit);

  // Languages whose newest title is most recent appear first in the rotation.
  const langs = [...byLang.keys()].sort((a, b) => {
    const aNewest = catalogRecencyMs(byLang.get(a)![0] as never);
    const bNewest = catalogRecencyMs(byLang.get(b)![0] as never);
    return bNewest - aNewest;
  });

  const cursor = new Map<string, number>();
  for (const lang of langs) cursor.set(lang, 0);

  const out: T[] = [];
  while (out.length < limit) {
    let progressed = false;
    for (const lang of langs) {
      const bucket = byLang.get(lang)!;
      const idx = cursor.get(lang)!;
      if (idx >= bucket.length) continue;
      out.push(bucket[idx]!);
      cursor.set(lang, idx + 1);
      progressed = true;
      if (out.length >= limit) break;
    }
    if (!progressed) break;
  }

  return out;
}
