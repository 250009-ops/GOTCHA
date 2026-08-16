export interface SplitChapter {
  title: string;
  text: string;
}

const CHAPTER_WORD =
  'chapter|глава|главы|bob|qism|часть|part|section|book|canto|act|scene';

const ROMAN = 'M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})';
const NUM = `(?:\\d{1,4}|${ROMAN})`;

const MARKDOWN_HEADING = /^(#{1,3})\s+(.+)$/;
const NUMBERED_CHAPTER = new RegExp(
  `^(?:#{1,3}\\s+)?(?:${CHAPTER_WORD})\\s+(${NUM})(?:\\s*[.:—–\\-]\\s*|\\s+)(.*)$`,
  'i',
);
const NUMBERED_CHAPTER_ONLY = new RegExp(
  `^(?:#{1,3}\\s+)?(?:${CHAPTER_WORD})\\s+(${NUM})\\.?$`,
  'i',
);
const UZ_BOB = /^(\d{1,3})[-.]?\s*bob\b(?:\s*[.:—–-]\s*|\s+)?(.*)$/i;
const NAMED_FRONT =
  /^(etymology|extracts?|epilogue|prologue|preface|introduction|afterword|coda|interlude|appendix|overture)(?:\s*[.:—–-]\s*(.*))?$/i;
const CONTENTS_ONLY = /^(contents|table of contents)\.?$/i;
const IMAGE_CAPTION = /^\[Image:\s*(.+?)\]$/i;
const GUTENBERG_START = /\*{3}\s*START OF (?:THE|THIS) PROJECT GUTENBERG[\s\S]*?\*{3}/i;
const GUTENBERG_END = /\*{3}\s*END OF (?:THE|THIS) PROJECT GUTENBERG[\s\S]*?\*{3}/i;

/** Isolated roman like "II." or "XIV" — never a lone "I" followed by a sentence. */
const ISOLATED_ROMAN = new RegExp(`^(${ROMAN})\\.?$`, 'i');
const ISOLATED_NUMBER = /^(\d{1,3})\.$/;

export function stripGutenbergBoilerplate(text: string): string {
  let out = text.replace(/\r\n/g, '\n');
  const start = out.search(GUTENBERG_START);
  if (start >= 0) {
    const after = out.slice(start).search(/\n/);
    out = after >= 0 ? out.slice(start + after + 1) : out;
  }
  const end = out.search(GUTENBERG_END);
  if (end >= 0) out = out.slice(0, end);
  return out.trim();
}

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function normalizeTitleKey(title: string): string {
  return collapseWs(title)
    .toLowerCase()
    .replace(/^#+\s+/, '')
    .replace(new RegExp(`^(?:${CHAPTER_WORD})\\s+`, 'i'), '')
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const NAMED_SECTION =
  /^(etymology|extracts|epilogue|prologue|preface|introduction|afterword|coda|interlude|appendix|overture)$/i;

function titleKeys(title: string): string[] {
  const full = normalizeTitleKey(title);
  const noNum = full.replace(/^(?:\d+|[ivxlcdm]+)\s+/, '');
  const first = full.split(' ')[0] || '';
  const keys = [full, noNum];
  if (NAMED_SECTION.test(first)) keys.push(first);
  return [...new Set(keys.filter((k) => k.length >= 4))];
}

function isEnglishSentence(line: string): boolean {
  const t = line.trim();
  if (/^(i|we|you|he|she|they|it)\s+[a-z]/i.test(t)) return true;
  if (t.length > 48 && /[,;]/.test(t)) return true;
  if (t.length > 70) return true;
  return false;
}

export function looksLikeTitleLine(line: string): boolean {
  const t = collapseWs(line);
  if (!t || t.length > 80) return false;
  if (isEnglishSentence(t)) return false;
  const words = t.split(/\s+/);
  if (words.length === 0 || words.length > 12) return false;
  if (/[,;:]$/.test(t) && t.length > 36) return false;
  return true;
}

function prettyChapterTitle(raw: string): string {
  const t = collapseWs(raw.replace(/^#+\s+/, ''));
  if (!t) return 'Chapter';
  return t
    .replace(/^(chapter|part|section|book)\b/i, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
    .replace(
      /^(etymology|extracts|epilogue|prologue|preface|introduction|afterword|coda|interlude|appendix|overture)\b/i,
      (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(),
    )
    .slice(0, 160);
}

function headingFromLine(
  line: string,
  nextLine?: string,
): { title: string; consumeNext: boolean } | null {
  const raw = line.trim();
  if (!raw || raw.length > 160) return null;

  const image = raw.match(IMAGE_CAPTION);
  if (image) {
    const inner = headingFromLine(image[1], nextLine);
    return inner ? { title: inner.title, consumeNext: false } : null;
  }

  const md = raw.match(MARKDOWN_HEADING);
  if (md) {
    const inner = collapseWs(md[2]);
    if (!inner || isEnglishSentence(inner)) return null;
    const nested = headingFromLine(inner, nextLine);
    return nested ?? { title: prettyChapterTitle(inner), consumeNext: false };
  }

  const numbered = raw.match(NUMBERED_CHAPTER);
  if (numbered) {
    const rest = collapseWs(numbered[2] || '');
    // Cetology-style asides: "CHAPTER I. (_Folio_), CHAPTER II. (_Right Whale_)."
    if (rest && /^[(_]/.test(rest)) return null;
    if (rest && isEnglishSentence(rest) && rest.length > 60) return null;
    const title = rest
      ? prettyChapterTitle(`Chapter ${numbered[1]}. ${rest}`)
      : prettyChapterTitle(`Chapter ${numbered[1]}`);
    return { title, consumeNext: false };
  }

  const only = raw.match(NUMBERED_CHAPTER_ONLY);
  if (only) {
    const next = nextLine?.trim() ?? '';
    if (next && looksLikeTitleLine(next) && !NUMBERED_CHAPTER.test(next) && !NUMBERED_CHAPTER_ONLY.test(next)) {
      return { title: prettyChapterTitle(`Chapter ${only[1]}. ${next}`), consumeNext: true };
    }
    return { title: prettyChapterTitle(`Chapter ${only[1]}`), consumeNext: false };
  }

  const bob = raw.match(UZ_BOB);
  if (bob) {
    const rest = collapseWs(bob[2] || '');
    const title = rest ? `${bob[1]}-bob. ${rest}` : `${bob[1]}-bob`;
    return { title: prettyChapterTitle(title), consumeNext: false };
  }

  if (CONTENTS_ONLY.test(raw)) {
    return { title: prettyChapterTitle(raw), consumeNext: false };
  }

  const named = raw.match(NAMED_FRONT);
  if (named && !isEnglishSentence(raw) && raw.length <= 80) {
    const rest = collapseWs(named[2] || '');
    const title = rest ? `${named[1]} ${rest}` : named[1];
    return { title: prettyChapterTitle(title), consumeNext: false };
  }

  const isolatedRoman = raw.match(ISOLATED_ROMAN);
  if (isolatedRoman) {
    const token = isolatedRoman[1].toUpperCase();
    // A lone "I" is almost always English first person unless the next line is a short title.
    const next = nextLine?.trim() ?? '';
    if (token === 'I' && (!next || !looksLikeTitleLine(next) || isEnglishSentence(next))) {
      return null;
    }
    if (next && looksLikeTitleLine(next) && !NUMBERED_CHAPTER.test(next)) {
      return { title: prettyChapterTitle(`Chapter ${token}. ${next}`), consumeNext: true };
    }
    if (token !== 'I') {
      return { title: prettyChapterTitle(`Chapter ${token}`), consumeNext: false };
    }
    return null;
  }

  if (ISOLATED_NUMBER.test(raw)) {
    const next = nextLine?.trim() ?? '';
    if (next && looksLikeTitleLine(next) && !isEnglishSentence(next)) {
      return { title: prettyChapterTitle(`Chapter ${raw.replace('.', '')}. ${next}`), consumeNext: true };
    }
  }

  return null;
}

/** Heading glued to the opening sentence: "CHAPTER 1. Loomings. Call me Ishmael." */
function splitMergedHeading(line: string): { title: string; rest: string } | null {
  const m = line
    .trim()
    .match(
      new RegExp(
        `^(?:#{1,3}\\s+)?((?:${CHAPTER_WORD})\\s+${NUM}\\s*[.:—–\\-]\\s+[^.]{2,70}\\.)\\s+([A-Z].+)$`,
        'i',
      ),
    );
  if (!m) return null;
  if (isEnglishSentence(m[1])) return null;
  return { title: prettyChapterTitle(m[1]), rest: m[2].trim() };
}

type FoundHeading = { index: number; title: string; consumeNext: boolean; rest?: string };

function isIsolatedLine(lines: string[], index: number): boolean {
  const prev = (lines[index - 1] ?? '').trim();
  const next = (lines[index + 1] ?? '').trim();
  return index === 0 || prev.length === 0 || next.length === 0;
}

function collectHeadings(lines: string[]): FoundHeading[] {
  const found: FoundHeading[] = [];
  for (let i = 0; i < lines.length; i++) {
    const merged = splitMergedHeading(lines[i]);
    if (merged && isIsolatedLine(lines, i)) {
      found.push({ index: i, title: merged.title, consumeNext: false, rest: merged.rest });
      continue;
    }
    const heading = headingFromLine(lines[i], lines[i + 1]);
    if (!heading) continue;
    if (!isIsolatedLine(lines, i) && !/^Chapter\s+\d+/i.test(heading.title)) continue;
    found.push({ index: i, title: heading.title, consumeNext: heading.consumeNext });
    if (heading.consumeNext) i += 1;
  }
  return found;
}

function arabicChapterNum(title: string): number | null {
  const m = title.match(/^Chapter\s+(\d+)\b/i);
  return m ? Number(m[1]) : null;
}

/** When a book has Chapter 1..N, ignore nested "CHAPTER I. (_Folio_)" asides. */
function preferNumberedSequence(headings: FoundHeading[]): FoundHeading[] {
  const nums = headings
    .map((h) => arabicChapterNum(h.title))
    .filter((n): n is number => n !== null);
  const unique = [...new Set(nums)].sort((a, b) => a - b);
  if (unique.length < 8 || unique[0] > 2) return headings;
  const span = unique[unique.length - 1] - unique[0] + 1;
  if (unique.length < span * 0.7) return headings;

  return headings.filter((h) => {
    if (arabicChapterNum(h.title) !== null) return true;
    if (CONTENTS_ONLY.test(h.title) || isTocOrContentsTitle(h.title)) return true;
    if (NAMED_SECTION.test(normalizeTitleKey(h.title).split(' ')[0] || '')) return true;
    return false;
  });
}

function dropTableOfContents(headings: FoundHeading[]): FoundHeading[] {
  if (headings.length < 2) return headings;

  const lastByKey = new Map<string, number>();
  headings.forEach((h, i) => {
    for (const key of titleKeys(h.title)) {
      lastByKey.set(key, i);
    }
  });

  const keep = new Set<number>();
  headings.forEach((h, i) => {
    const keys = titleKeys(h.title);
    const isDuplicate = keys.some((key) => lastByKey.get(key) !== i && lastByKey.has(key));
    if (!isDuplicate) keep.add(i);
    else if (keys.some((key) => lastByKey.get(key) === i)) keep.add(i);
  });

  const remaining = headings.filter((_, i) => keep.has(i));
  return remaining.length >= 1 ? remaining : headings;
}

function isTocOrContentsTitle(title: string): boolean {
  return /^(contents|table of contents)$/i.test(title.trim());
}

/**
 * High-precision literary chapter split.
 * Prefers explicit chapter headings; never treats "I am…" sentences as Roman numerals.
 * Drops Gutenberg license wrappers and table-of-contents duplicates.
 */
function isMostlyTocListing(text: string): boolean {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 4) return false;
  const hits = lines.filter(
    (l) =>
      CONTENTS_ONLY.test(l) ||
      NAMED_FRONT.test(l) ||
      NUMBERED_CHAPTER.test(l) ||
      NUMBERED_CHAPTER_ONLY.test(l) ||
      /^(#{1,3}\s+)?(chapter|глава|etymology|extracts|epilogue)\b/i.test(l),
  ).length;
  return hits / lines.length >= 0.45;
}

/** Drop the CONTENTS / TOC listing; keep the real chapter bodies that follow. */
export function stripContentsListing(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => {
    const t = l.trim().replace(/^#+\s+/, '');
    return CONTENTS_ONLY.test(t);
  });
  if (start < 0) return text;

  let i = start + 1;
  while (i < lines.length) {
    const t = lines[i].trim();
    if (!t) {
      i += 1;
      continue;
    }
    const heading = headingFromLine(t, lines[i + 1]);
    if (!heading) break;
    let j = i + 1 + (heading.consumeNext ? 1 : 0);
    while (j < lines.length && !lines[j].trim()) j += 1;
    const next = lines[j]?.trim() ?? '';
    const nextHeading = next ? headingFromLine(next, lines[j + 1]) : null;
    if (nextHeading || !next) {
      i = j;
      continue;
    }
    break;
  }

  return [...lines.slice(0, start), ...lines.slice(i)].join('\n').trim();
}

export function splitAccurateChapters(text: string, fallbackTitle = 'Chapter 1'): SplitChapter[] {
  const prepared = stripContentsListing(
    stripGutenbergBoilerplate(text.replace(/\r\n/g, '\n')),
  ).trim();
  if (!prepared) return [];

  const lines = prepared.split('\n');
  const headings = preferNumberedSequence(dropTableOfContents(collectHeadings(lines))).filter(
    (h) => !isTocOrContentsTitle(h.title),
  );

  if (headings.length < 1) {
    return [{ title: fallbackTitle.slice(0, 160), text: prepared }];
  }

  const chapters: SplitChapter[] = [];
  const first = headings[0];
  if (first.index > 0) {
    const preface = lines.slice(0, first.index).join('\n').trim();
    if (preface && wordCount(preface) >= 80 && !isMostlyTocListing(preface)) {
      chapters.push({ title: fallbackTitle.slice(0, 160), text: preface });
    }
  }

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    const start = h.index + 1 + (h.consumeNext ? 1 : 0);
    const end = i + 1 < headings.length ? headings[i + 1].index : lines.length;
    const bodyLines = lines.slice(start, end);
    if (h.rest) bodyLines.unshift(h.rest);
    const body = bodyLines.join('\n').trim();
    if (!body || isMostlyTocListing(body)) continue;
    chapters.push({ title: h.title.slice(0, 160), text: body });
  }

  const merged = mergeNamedDuplicates(chapters).filter(
    (c) => !isTocOrContentsTitle(c.title) && !isMostlyTocListing(c.text),
  );
  return merged.length ? merged : [{ title: fallbackTitle.slice(0, 160), text: prepared }];
}

function namedSectionKey(title: string): string | null {
  const first = normalizeTitleKey(title).split(' ')[0] || '';
  return NAMED_SECTION.test(first) ? first : null;
}

function mergeNamedDuplicates(chapters: SplitChapter[]): SplitChapter[] {
  const out: SplitChapter[] = [];
  for (const chapter of chapters) {
    const prev = out[out.length - 1];
    const key = namedSectionKey(chapter.title);
    const prevKey = prev ? namedSectionKey(prev.title) : null;
    if (prev && key && key === prevKey) {
      const title = chapter.title.length >= prev.title.length ? chapter.title : prev.title;
      prev.title = title;
      prev.text = `${prev.text}\n\n${chapter.text}`.trim();
      continue;
    }
    out.push({ ...chapter });
  }
  return out;
}

function wordCount(text: string): number {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

export function chaptersHaveRealTitles(chapters: SplitChapter[]): boolean {
  if (chapters.length < 2) return false;
  const generic = chapters.filter((c) => /^(page|pages)\s+\d/i.test(c.title.trim())).length;
  return generic / chapters.length < 0.3;
}

/** Match PDF outline / TOC titles to positions in extracted text and split there. */
export function splitByOutlineTitles(
  text: string,
  titles: string[],
  fallbackTitle = 'Chapter 1',
): SplitChapter[] | null {
  const cleaned = titles.map((t) => collapseWs(t)).filter((t) => t.length >= 2 && t.length <= 120);
  if (cleaned.length < 2) return null;

  const haystack = text.replace(/\r\n/g, '\n');
  const positions: Array<{ index: number; title: string }> = [];
  let cursor = 0;

  for (const title of cleaned) {
    const keys = titleKeys(title);
    const idx = findTitleIndex(haystack, title, keys, cursor);
    if (idx < 0) continue;
    positions.push({ index: idx, title: prettyChapterTitle(title) });
    cursor = idx + Math.max(title.length, 1);
  }

  if (positions.length < 2 || positions.length < cleaned.length * 0.45) return null;

  const chapters: SplitChapter[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : haystack.length;
    let body = haystack.slice(start, end).trim();
    const headingLine = body.split('\n')[0] ?? '';
    if (normalizeTitleKey(headingLine) === normalizeTitleKey(positions[i].title) || titleKeys(headingLine).some((k) => titleKeys(positions[i].title).includes(k))) {
      body = body.slice(headingLine.length).trim();
    }
    if (!body) continue;
    chapters.push({ title: positions[i].title.slice(0, 160), text: body });
  }

  if (chapters.length < 2) return null;
  if (positions[0].index > 0) {
    const preface = haystack.slice(0, positions[0].index).trim();
    if (preface && wordCount(preface) >= 80) {
      chapters.unshift({ title: fallbackTitle.slice(0, 160), text: preface });
    }
  }
  return chapters;
}

function findTitleIndex(text: string, title: string, keys: string[], from: number): number {
  const direct = text.toLowerCase().indexOf(title.toLowerCase(), from);
  if (direct >= 0) return direct;

  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    if (offset + line.length < from) {
      offset += line.length + 1;
      continue;
    }
    const lineKeys = titleKeys(line);
    if (keys.some((k) => lineKeys.includes(k) || lineKeys.some((lk) => lk === k))) {
      return offset;
    }
    const collapsed = normalizeTitleKey(line);
    if (keys.includes(collapsed)) return offset;
    offset += line.length + 1;
  }
  return -1;
}
