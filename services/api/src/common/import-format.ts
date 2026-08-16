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
