import { BadRequestException } from '@nestjs/common';

/**
 * Import page tiers: pure helpers shared by admin validation, quotes and the public landing payload.
 * `ImportPageTier.priceUsd` stores UZS (soʻm), not USD.
 *
 * Live bugs (2026-10-31, landing.json):
 *  - "901 - 1500 pages" had price 0 → landing rendered "0 soʻm" (admin allowed 0 = "free").
 *  - "1 - 40 pages" row actually had maxPages=100 → no visible 41–100 row; label and range drifted.
 */
export type PageTierRow = {
  id: string;
  label: string;
  minPages: number;
  maxPages: number | null;
  priceUzs: number;
  active?: boolean;
  sortOrder?: number;
};

export type PageTierIssue =
  | { code: 'zero_price' | 'below_min'; tierId: string; label: string; priceUzs: number }
  | { code: 'label_mismatch'; tierId: string; label: string; expected: string }
  | { code: 'gap'; afterTierId: string | null; fromPage: number; toPage: number }
  | { code: 'overlap'; tierId: string; otherTierId: string; fromPage: number; toPage: number }
  | { code: 'unbounded_not_last'; tierId: string };

export function pageTierRangeLabel(minPages: number, maxPages: number | null): string {
  return maxPages == null ? `${minPages}+ pages` : `${minPages} - ${maxPages} pages`;
}

/** Numbers written in a label ("1 - 40 pages", "100+ pages"). null when the label has no range. */
export function parseLabelRange(label: string): { min: number; max: number | null } | null {
  const s = String(label ?? '');
  const range = s.match(/(\d+)\s*[-–—]\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const plus = s.match(/(\d+)\s*\+/);
  if (plus) return { min: Number(plus[1]), max: null };
  return null;
}

/** True when a label states a range that differs from the stored min/max. Labels without numbers are fine. */
export function labelRangeMismatch(label: string, minPages: number, maxPages: number | null): boolean {
  const parsed = parseLabelRange(label);
  if (!parsed) return false;
  if (parsed.max == null) {
    // "100+ pages" is the conventional label for min 101 / unbounded; accept n or n+1.
    return !(maxPages == null && (parsed.min === minPages || parsed.min + 1 === minPages));
  }
  return parsed.min !== minPages || parsed.max !== maxPages;
}

/** A tier can be sold only when its price meets the Atmos minimum (0 is never a valid page-tier price). */
export function isSellableTier(t: Pick<PageTierRow, 'priceUzs' | 'active'>, minSom: number): boolean {
  if (t.active === false) return false;
  const p = Number(t.priceUzs);
  return Number.isFinite(p) && p > 0 && p >= minSom;
}

export function validatePageTierSet(tiers: PageTierRow[], minSom: number): PageTierIssue[] {
  const issues: PageTierIssue[] = [];
  const active = tiers.filter((t) => t.active !== false).sort((a, b) => a.minPages - b.minPages);
  for (const t of active) {
    const p = Number(t.priceUzs);
    if (!(p > 0)) issues.push({ code: 'zero_price', tierId: t.id, label: t.label, priceUzs: p || 0 });
    else if (p < minSom) issues.push({ code: 'below_min', tierId: t.id, label: t.label, priceUzs: p });
    if (labelRangeMismatch(t.label, t.minPages, t.maxPages)) {
      issues.push({ code: 'label_mismatch', tierId: t.id, label: t.label, expected: pageTierRangeLabel(t.minPages, t.maxPages) });
    }
  }
  let expectedNext = 1;
  let prev: PageTierRow | null = null;
  for (const t of active) {
    if (prev && prev.maxPages == null) {
      issues.push({ code: 'unbounded_not_last', tierId: prev.id });
    }
    if (t.minPages > expectedNext) {
      issues.push({ code: 'gap', afterTierId: prev?.id ?? null, fromPage: expectedNext, toPage: t.minPages - 1 });
    } else if (prev && t.minPages < expectedNext) {
      issues.push({
        code: 'overlap',
        tierId: t.id,
        otherTierId: prev.id,
        fromPage: t.minPages,
        toPage: Math.min(expectedNext - 1, t.maxPages ?? expectedNext - 1),
      });
    }
    expectedNext = t.maxPages == null ? Number.POSITIVE_INFINITY : Math.max(expectedNext, t.maxPages + 1);
    prev = t;
  }
  return issues;
}

/** Tiers safe to show publicly: active, priced at/above the Atmos minimum, label regenerated from the range. */
export function publicPageTiers<T extends PageTierRow>(tiers: T[], minSom: number): T[] {
  return tiers
    .filter((t) => isSellableTier(t, minSom))
    .sort((a, b) => a.minPages - b.minPages)
    .map((t) => ({ ...t, label: pageTierRangeLabel(t.minPages, t.maxPages) }));
}

function badRequest(message: string): Error {
  return new BadRequestException(message);
}

/** Page tiers are always paid: 0 is rejected (use the free allowance for free imports). */
export function assertPageTierPrice(price: number, label: string, minSom: number): void {
  if (!Number.isFinite(price) || price <= 0) {
    throw badRequest(`Page tier "${label}" needs a price of at least ${minSom.toLocaleString()} soʻm. Use the free allowance for free imports.`);
  }
  if (price < minSom) {
    throw badRequest(`Page tier "${label}" must be at least ${minSom.toLocaleString()} soʻm (Atmos minimum). Current value: ${Math.round(price).toLocaleString()} soʻm.`);
  }
}

/** Reject a create/update whose range overlaps another active tier. Gaps are reported, not blocked (edits are one row at a time). */
export function assertNoPageTierOverlap(
  existing: Array<{ id: string; minPages: number; maxPages: number | null; active?: boolean }>,
  next: { id: string | null; minPages: number; maxPages: number | null },
): void {
  const hi = next.maxPages ?? Number.POSITIVE_INFINITY;
  for (const t of existing) {
    if (t.id === next.id || t.active === false) continue;
    const tHi = t.maxPages ?? Number.POSITIVE_INFINITY;
    if (next.minPages <= tHi && t.minPages <= hi) {
      throw badRequest(`Pages ${pageTierRangeLabel(next.minPages, next.maxPages)} overlap the existing tier ${pageTierRangeLabel(t.minPages, t.maxPages)}.`);
    }
  }
}
