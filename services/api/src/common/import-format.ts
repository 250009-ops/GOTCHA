const FORMAT_ALIASES: Record<string, string> = {
  article: 'article',
  articles: 'article',
  webpage: 'article',
  url: 'article',
  paste: 'article',
  news: 'news',
  ebook: 'ebook',
  'e-book': 'ebook',
  book: 'ebook',
  books: 'ebook',
  novel: 'ebook',
  epub: 'ebook',
  pdf: 'ebook',
  gutenberg: 'ebook',
  'project-gutenberg': 'ebook',
  pg: 'ebook',
  research: 'research',
  paper: 'research',
  papers: 'research',
  research_paper: 'research',
  custom: 'custom',
  document: 'custom',
  upload: 'custom',
};

export const IMPORT_FORMATS = ['article', 'news', 'ebook', 'research', 'custom'] as const;
export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export function normalizeImportFormat(raw: string | null | undefined): string {
  const key = (raw ?? '').trim().toLowerCase();
  return FORMAT_ALIASES[key] ?? key;
}

export function normalizeAllowedFormats(list: unknown): ImportFormat[] {
  if (!Array.isArray(list)) return ['article', 'news'];
  const next = [...new Set(list.map((item) => normalizeImportFormat(String(item))))].filter(
    (item): item is ImportFormat => (IMPORT_FORMATS as readonly string[]).includes(item),
  );
  return next.length ? next : ['article', 'news'];
}

export function formatIsAllowed(allowed: string[], contentFormat: string): boolean {
  const want = normalizeImportFormat(contentFormat);
  return normalizeAllowedFormats(allowed).includes(want as ImportFormat);
}

export type PageRange = {
  label?: string;
  minPages: number;
  maxPages: number | null;
};

/** Unpriced or overlapping page ranges — paid quotes cannot be trusted in these holes. */
export function describePageTierGaps(tiers: PageRange[]): string[] {
  const sorted = [...tiers].sort((a, b) => a.minPages - b.minPages);
  const gaps: string[] = [];
  if (!sorted.length) return ['No page tiers configured — paid imports cannot be priced.'];
  if (sorted[0].minPages > 1) {
    gaps.push(`No price for pages 1–${sorted[0].minPages - 1}.`);
  }
  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    const next = sorted[i + 1];
    const name = t.label?.trim() || `${t.minPages}${t.maxPages == null ? '+' : `–${t.maxPages}`}`;
    if (t.maxPages != null && t.maxPages < t.minPages) {
      gaps.push(`“${name}” has max below min.`);
    }
    if (t.maxPages == null) {
      if (next) {
        gaps.push(`“${name}” is open-ended (${t.minPages}+) so later tiers never apply.`);
      }
      continue;
    }
    if (!next) continue;
    const nextName = next.label?.trim() || `${next.minPages}${next.maxPages == null ? '+' : `–${next.maxPages}`}`;
    if (t.maxPages + 1 < next.minPages) {
      gaps.push(`No price for pages ${t.maxPages + 1}–${next.minPages - 1}.`);
    } else if (t.maxPages >= next.minPages) {
      gaps.push(`“${name}” overlaps “${nextName}” at page ${next.minPages}.`);
    }
  }
  return gaps;
}

export function defaultPageTierLabel(minPages: number, maxPages: number | null): string {
  if (maxPages == null) return `${minPages}+ pages`;
  return `${minPages} - ${maxPages} pages`;
}

/** Next empty range after existing tiers (open-ended if the previous band has a max). */
export function suggestNextPageRange(tiers: PageRange[]): { minPages: number; maxPages: number | null } {
  if (!tiers.length) return { minPages: 1, maxPages: 10 };
  const highs = tiers.map((t) => (t.maxPages != null ? t.maxPages : t.minPages));
  const high = Math.max(0, ...highs);
  return { minPages: Math.max(1, high + 1), maxPages: null };
}
