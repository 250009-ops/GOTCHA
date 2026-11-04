import { BadRequestException } from '@nestjs/common';
import { defaultPageTierLabel } from './import-format';

export type TierRow = { label: string; minPages: number; maxPages: number | null; price: number };

/** final-5: rules for the whole active page-tier table. Returns a list of problems (empty = valid).
 *  Starts at page 1; contiguous (next min = previous max + 1) with no overlap or gap; only the last tier may be open-ended;
 *  each label must match its range ("1 - 10 pages", "101+ pages"); each price must be > 0 soʻm. */
export function pageTierProblems(rows: TierRow[]): string[] {
  const p: string[] = [];
  const t = [...rows].sort((a, b) => a.minPages - b.minPages);
  t.forEach((r, i) => {
    const want = defaultPageTierLabel(r.minPages, r.maxPages);
    if (r.label.trim().replace(/\s*[-–]\s*/, ' - ') !== want) p.push(`Label "${r.label}" does not match its range (expected "${want}").`);
    if (!(Number(r.price) > 0)) p.push(`Tier "${want}" needs a price above 0 soʻm.`);
    if (r.maxPages != null && r.maxPages < r.minPages) p.push(`Tier "${want}" ends before it starts.`);
    if (i === 0 && r.minPages !== 1) p.push(`The first tier must start at page 1 (starts at ${r.minPages}).`);
    if (r.maxPages == null && i !== t.length - 1) p.push(`Only the last tier may be open-ended ("${want}" is not last).`);
    const prev = t[i - 1];
    if (prev && prev.maxPages != null) {
      if (r.minPages <= prev.maxPages) p.push(`Tier "${want}" overlaps the tier ending at ${prev.maxPages}.`);
      else if (r.minPages !== prev.maxPages + 1) p.push(`Gap between page ${prev.maxPages} and ${r.minPages}.`);
    }
  });
  return p;
}

export function assertValidPageTiers(rows: TierRow[]) {
  const problems = pageTierProblems(rows);
  if (problems.length) throw new BadRequestException({ statusCode: 400, code: 'INVALID_PAGE_TIERS', message: problems.join(' '), problems });
}
