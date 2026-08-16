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

/** Best-to-fallback plain-text sources — illustrated HTML often loses chapter titles. */
export function gutenbergPlainTextUrls(id: string): string[] {
  return [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-8.txt`,
    `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`,
  ];
}

export function isGutenbergUrl(url: string): boolean {
  return parseGutenbergId(url) !== null;
}
