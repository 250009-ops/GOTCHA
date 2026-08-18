/** Catalog page ceiling — keep in sync with MAX_PDF_PAGES / quote DTO. */
export const MAX_BILLABLE_PAGES = 4000;

/**
 * Count PDF pages from uncompressed catalog objects.
 * Returns null for encrypted files or PDF 1.5 object streams (use pdf-parse).
 */
export function countPdfPagesFromLatin1(latin1: string): number | null {
  if (!latin1.includes('%PDF')) return null;

  let maxCount = 0;
  const withTypeThenCount = /\/Type\s*\/Pages\b[\s\S]{0,1200}?\/Count\s+(\d+)/g;
  const withCountThenType = /\/Count\s+(\d+)[\s\S]{0,1200}?\/Type\s*\/Pages\b/g;
  for (const re of [withTypeThenCount, withCountThenType]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(latin1))) {
      const n = Number(match[1]);
      if (Number.isFinite(n) && n > maxCount) maxCount = n;
    }
  }
  if (maxCount > 0) return Math.min(MAX_BILLABLE_PAGES, maxCount);

  const leaves = latin1.match(/\/Type\s*\/Page(?!s)\b/g);
  if (leaves?.length) return Math.min(MAX_BILLABLE_PAGES, leaves.length);
  return null;
}

export function countPdfPagesFromBytes(bytes: Uint8Array | Buffer): number | null {
  const latin1 = Buffer.from(bytes).toString('latin1');
  return countPdfPagesFromLatin1(latin1);
}
