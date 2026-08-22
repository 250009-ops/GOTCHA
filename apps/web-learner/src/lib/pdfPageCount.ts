const MAX_BILLABLE_PAGES = 4000;

/** Count PDF catalog pages from uncompressed objects. Returns null for object streams. */
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

export async function countPdfPagesFromFile(file: File): Promise<number | null> {
  const buffer = new Uint8Array(await file.arrayBuffer());
  const latin1 = new TextDecoder('latin1').decode(buffer);
  return countPdfPagesFromLatin1(latin1);
}
