/** Project Gutenberg ebook id from common URL shapes. */
export function parseGutenbergId(url: string): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./i, '').toLowerCase();
    if (host !== 'gutenberg.org' && host !== 'gutenberg.cc' && !host.endsWith('.gutenberg.org')) {
      return null;
    }
    const path = u.pathname;
    const patterns = [
      /\/ebooks\/(\d+)/i,
      /\/epub\/(\d+)/i,
      /\/files\/(\d+)/i,
      /\/cache\/epub\/(\d+)/i,
    ];
    for (const re of patterns) {
      const m = path.match(re);
      if (m) return m[1];
    }
    const file = path.match(/pg(\d+)/i);
    return file?.[1] ?? null;
  } catch {
    return null;
  }
}

/** aleph.gutenberg.org path: 2701 → 2/7/0/2701 */
export function gutenbergAlephPath(id: string): string {
  const digits = String(id).replace(/\D/g, '');
  if (digits.length <= 1) return digits;
  return `${digits.slice(0, -1).split('').join('/')}/${digits}`;
}

/** Best-to-fallback plain-text sources — illustrated HTML often loses chapter titles. */
export function gutenbergPlainTextUrls(id: string): string[] {
  const aleph = gutenbergAlephPath(id);
  return [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-8.txt`,
    `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
    `https://aleph.gutenberg.org/${aleph}/${id}-0.txt`,
    `https://aleph.gutenberg.org/${aleph}/${id}-8.txt`,
    `http://www.gutenberg.org/files/${id}/${id}-0.txt`,
  ];
}

/** Compact HTML only — illustrated `*-images.html` is huge and OOMs the API (502s). */
export function gutenbergHtmlBookUrls(id: string): string[] {
  return [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.html`,
    `https://www.gutenberg.org/ebooks/${id}.html.noimages`,
    `https://www.gutenberg.org/files/${id}/${id}-h/${id}-h.htm`,
    `https://www.gutenberg.org/files/${id}/${id}-h/${id}-h.html`,
  ];
}

/** Illustrated HTML dumps (images inline) — last-resort only, never preferred over TXT. */
export function isGutenbergIllustratedHtmlUrl(url: string): boolean {
  return /pg\d+-images\.html|html\.images/i.test(url);
}

export function isGutenbergUrl(url: string): boolean {
  return parseGutenbergId(url) !== null;
}

/** Catalog / download splash pages are not the novel. */
export function looksLikeGutenbergLandingPage(html: string, wordCount: number): boolean {
  if (wordCount >= 8_000) return false;
  const h = html.toLowerCase();
  const markers =
    h.includes('plain text utf-8') ||
    h.includes('download this ebook') ||
    h.includes('bibrec') ||
    h.includes('id="download"');
  return markers && wordCount < 2_500;
}
