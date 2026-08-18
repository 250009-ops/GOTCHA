export interface SplitChapter {
  title: string;
  text: string;
}

const CHAPTER_WORD =
  'chapter|глава|главы|bob|qism|часть|part|section|book|canto|act|scene|adventure';

const ROMAN = '(?=[IVXLCDM])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})';
const NUM = `(?:\\d{1,4}|${ROMAN})`;
const WORD_NUM =
  'one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth';

const MARKDOWN_HEADING = /^(#{1,3})\s+(.+)$/;
const NUMBERED_CHAPTER = new RegExp(
  `^(?:#{1,3}\\s+)?(?:${CHAPTER_WORD})\\s+(${NUM})(?:\\s*[.:—–\\-]\\s*|\\s+)(.*)$`,
  'i',
);
const NUMBERED_CHAPTER_ONLY = new RegExp(
  `^(?:#{1,3}\\s+)?(?:${CHAPTER_WORD})\\s+(${NUM})\\.?$`,
  'i',
);
const NUMBERED_WORD_CHAPTER = new RegExp(
  `^(?:#{1,3}\\s+)?(?:${CHAPTER_WORD})\\s+(${WORD_NUM})(?:\\s*[.:—–\\-]\\s*|\\s+)?(.*)$`,
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
const ISOLATED_NUMBER = /^(\d{1,3})\.?$/;
/** "1 ANTHONY CADE SIGNS ON" / "I. A Lady in Distress" — number without the word Chapter. */
const BARE_NUMBERED_TITLE = new RegExp(`^(?:#{1,3}\\s+)?(${NUM})(?:[.:—–-]|\\s+)\\s*(.+)$`, 'i');

const TITLE_STOP = new Set([
  'of',
  'the',
  'a',
  'an',
  'and',
  'in',
  'on',
  'at',
  'to',
  'for',
  'or',
  'nor',
  'vs',
  'versus',
  'de',
  'del',
  'van',
  'von',
]);

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

/** Drop dotted leaders / italic page refs from TOC lines: `_12_` or `.... 12`. */
function stripTocPageRef(s: string): string {
  const t = collapseWs(s)
    .replace(/\s*_{1,2}\d+[a-z]?_{1,2}\s*$/i, '')
    .replace(/\s*[\.·•…─\-—]{2,}\s*\d{1,4}\s*$/g, '');
  // "1 TITLE 12" — trailing page number, not the chapter number in "CHAPTER 4".
  if (/^(?:(?:chapter|глава|part|book|adventure)\s+)?(?:\d+|[ivxlcdm]+)\b.+\s+\d{1,4}$/i.test(t)) {
    return t.replace(/\s+\d{1,4}$/, '').trim();
  }
  return t;
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
  const full = normalizeTitleKey(stripTocPageRef(title));
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
  if (/^[“"‘']/.test(t)) return false;
  if (isEnglishSentence(t)) return false;
  const words = t.split(/\s+/);
  if (words.length === 0 || words.length > 12) return false;
  if (/[,;:]$/.test(t) && t.length > 36) return false;
  return true;
}

function looksLikeChapterTitle(line: string): boolean {
  const t = stripTocPageRef(line).replace(/\s*\(_?\s*(?:contd\.?|continued)_?\s*\)\s*$/i, '');
  if (!looksLikeTitleLine(t) && !looksLikeTitleLine(line)) return false;
  const probe = looksLikeTitleLine(t) ? t : stripTocPageRef(line);
  if (/^[(_[]/.test(probe)) return false;
  if (/^(i|we|you|he|she|they|it|call|there|this|that|what|when|where|why|how|if|as)\s+/i.test(probe)) {
    return false;
  }
  const words = probe.replace(/[.:]+$/, '').split(/\s+/).filter(Boolean);
  if (!words.length) return false;
  if (!/^[\p{Lu}]/u.test(words[0]) && !/^\d/.test(words[0])) return false;
  if (words.length === 1 && words[0].length < 4) return false;
  const filler = /^(?:\d+(?:st|nd|rd|th)?|contd|continued)$/i;
  const content = words.filter((w) => {
    const clean = w.replace(/[().,]/g, '');
    if (filler.test(clean)) return false;
    return w.length > 3 || !TITLE_STOP.has(w.toLowerCase());
  });
  const capitalized = content.filter((w) => /^[\p{Lu}]/u.test(w) || /^\d/.test(w));
  if (content.length === 0) return true;
  return capitalized.length >= Math.ceil(content.length * 0.6);
}

function prettyChapterTitle(raw: string): string {
  const t = collapseWs(stripTocPageRef(raw.replace(/^#+\s+/, '')));
  if (!t) return 'Chapter';
  return t
    .replace(/^(chapter|part|section|book|adventure)\b/i, (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase())
    .replace(
      /^(etymology|extracts|epilogue|prologue|preface|introduction|afterword|coda|interlude|appendix|overture)\b/i,
      (m) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase(),
    )
    .slice(0, 160);
}

type HeadingKind = 'explicit' | 'inferred';

type ParsedHeading = { title: string; consumeNext: boolean; kind: HeadingKind };

function headingFromLine(
  line: string,
  nextLine?: string,
): ParsedHeading | null {
  const raw = stripTocPageRef(line.trim());
  if (!raw || raw.length > 160) return null;

  const image = raw.match(IMAGE_CAPTION);
  if (image) {
    const inner = headingFromLine(image[1], nextLine);
    return inner ? { title: inner.title, consumeNext: false, kind: inner.kind } : null;
  }

  const md = raw.match(MARKDOWN_HEADING);
  if (md) {
    const inner = collapseWs(md[2]);
    if (!inner || isEnglishSentence(inner)) return null;
    const nested = headingFromLine(inner, nextLine);
    return nested ?? { title: prettyChapterTitle(inner), consumeNext: false, kind: 'explicit' };
  }

  const numbered = raw.match(NUMBERED_CHAPTER);
  if (numbered) {
    const rest = collapseWs(numbered[2] || '');
    if (rest) {
      // Cetology-style asides: "CHAPTER I. (_Folio_), CHAPTER II. (_Right Whale_)."
      if (/^[(_]/.test(rest)) return null;
      if (isEnglishSentence(rest) && rest.length > 60) return null;
      const title = prettyChapterTitle(`Chapter ${numbered[1]}. ${rest}`);
      return { title, consumeNext: false, kind: 'explicit' };
    }
    // "CHAPTER XV." with the name on the next line — handled below as ONLY.
  }

  const only = raw.match(NUMBERED_CHAPTER_ONLY);
  if (only) {
    const next = nextLine?.trim() ?? '';
    if (next && looksLikeChapterTitle(next) && !NUMBERED_CHAPTER.test(next) && !NUMBERED_CHAPTER_ONLY.test(next)) {
      return { title: prettyChapterTitle(`Chapter ${only[1]}. ${next}`), consumeNext: true, kind: 'explicit' };
    }
    return { title: prettyChapterTitle(`Chapter ${only[1]}`), consumeNext: false, kind: 'explicit' };
  }

  const wordNum = raw.match(NUMBERED_WORD_CHAPTER);
  if (wordNum) {
    const rest = collapseWs(wordNum[2] || '');
    if (rest && isEnglishSentence(rest) && rest.length > 60) return null;
    const title = rest
      ? prettyChapterTitle(`Chapter ${wordNum[1]}. ${rest}`)
      : prettyChapterTitle(`Chapter ${wordNum[1]}`);
    return { title, consumeNext: false, kind: 'explicit' };
  }

  const bob = raw.match(UZ_BOB);
  if (bob) {
    const rest = collapseWs(bob[2] || '');
    const title = rest ? `${bob[1]}-bob. ${rest}` : `${bob[1]}-bob`;
    return { title: prettyChapterTitle(title), consumeNext: false, kind: 'explicit' };
  }

  if (CONTENTS_ONLY.test(raw)) {
    return { title: prettyChapterTitle(raw), consumeNext: false, kind: 'explicit' };
  }

  const named = raw.match(NAMED_FRONT);
  if (named && !isEnglishSentence(raw) && raw.length <= 80) {
    const rest = collapseWs(named[2] || '');
    const title = rest ? `${named[1]} ${rest}` : named[1];
    return { title: prettyChapterTitle(title), consumeNext: false, kind: 'explicit' };
  }

  const isolatedRoman = raw.match(ISOLATED_ROMAN);
  if (isolatedRoman) {
    const token = isolatedRoman[1].toUpperCase();
    const next = nextLine?.trim() ?? '';
    // A lone "I" is almost always English first person unless the next line is a short title.
    if (token === 'I' && (!next || !looksLikeChapterTitle(next) || isEnglishSentence(next))) {
      return null;
    }
    if (next && looksLikeChapterTitle(next) && !NUMBERED_CHAPTER.test(next)) {
      return { title: prettyChapterTitle(`Chapter ${token}. ${next}`), consumeNext: true, kind: 'inferred' };
    }
    if (token !== 'I') {
      return { title: prettyChapterTitle(`Chapter ${token}`), consumeNext: false, kind: 'inferred' };
    }
    return null;
  }

  if (ISOLATED_NUMBER.test(raw)) {
    const next = nextLine?.trim() ?? '';
    if (next && looksLikeChapterTitle(next) && !isEnglishSentence(next)) {
      return {
        title: prettyChapterTitle(`Chapter ${raw.replace('.', '')}. ${next}`),
        consumeNext: true,
        kind: 'inferred',
      };
    }
  }

  const bare = raw.match(BARE_NUMBERED_TITLE);
  if (bare) {
    const rest = collapseWs(bare[2] || '');
    if (rest && looksLikeChapterTitle(rest) && !isEnglishSentence(rest)) {
      return {
        title: prettyChapterTitle(`Chapter ${bare[1]}. ${rest}`),
        consumeNext: false,
        kind: 'inferred',
      };
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

type FoundHeading = {
  index: number;
  title: string;
  consumeNext: boolean;
  consumeIndex?: number;
  rest?: string;
  kind: HeadingKind;
};

function nextNonEmptyIndex(lines: string[], from: number): number {
  for (let i = from; i < lines.length; i++) {
    if (lines[i].trim()) return i;
  }
  return -1;
}

function isIsolatedLine(lines: string[], index: number): boolean {
  const prev = (lines[index - 1] ?? '').trim();
  const next = (lines[index + 1] ?? '').trim();
  return index === 0 || prev.length === 0 || next.length === 0;
}

function headingAt(lines: string[], index: number): ParsedHeading | null {
  const nextIdx = nextNonEmptyIndex(lines, index + 1);
  const nextLine = nextIdx >= 0 ? lines[nextIdx] : '';
  return headingFromLine(lines[index], nextLine);
}

function collectHeadings(lines: string[]): FoundHeading[] {
  const found: FoundHeading[] = [];
  for (let i = 0; i < lines.length; i++) {
    const nextIdx = nextNonEmptyIndex(lines, i + 1);
    const nextLine = nextIdx >= 0 ? lines[nextIdx] : '';
    const merged = splitMergedHeading(lines[i]);
    if (merged && isIsolatedLine(lines, i)) {
      found.push({
        index: i,
        title: merged.title,
        consumeNext: false,
        rest: merged.rest,
        kind: 'explicit',
      });
      continue;
    }
    const heading = headingFromLine(lines[i], nextLine);
    if (!heading) continue;
    if (!isIsolatedLine(lines, i) && heading.kind !== 'explicit') continue;
    const consumeIndex = heading.consumeNext && nextIdx > i ? nextIdx : undefined;
    found.push({
      index: i,
      title: heading.title,
      consumeNext: heading.consumeNext,
      consumeIndex,
      kind: heading.kind,
    });
    if (consumeIndex !== undefined) i = consumeIndex;
  }
  return found;
}

function arabicChapterNum(title: string): number | null {
  return parseChapterOrdinal(title);
}

function romanToInt(raw: string): number | null {
  const s = raw.toUpperCase();
  if (!/^[IVXLCDM]{1,8}$/.test(s)) return null;
  const val: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const a = val[s[i]];
    const b = val[s[i + 1]] ?? 0;
    n += a < b ? -a : a;
  }
  return n > 0 ? n : null;
}

/** "Chapter XV. The Accuser" / "I. Loomings" / "Chapter 12" → 15 / 1 / 12. */
function parseChapterOrdinal(title: string): number | null {
  const t = stripTocPageRef(title).replace(/^#+\s+/, '');
  const m = t.match(/^(?:(?:chapter|глава|part|book|adventure)\s+)?(?:(\d{1,4})|([IVXLCDM]{1,8}))\b/i);
  if (!m) return null;
  if (m[1]) return Number(m[1]);
  return romanToInt(m[2]);
}

/** When a book has Chapter 1..N, ignore nested "CHAPTER I. (_Folio_)" asides. */
function preferNumberedSequence(headings: FoundHeading[]): FoundHeading[] {
  const nums = headings
    .map((h) => arabicChapterNum(h.title))
    .filter((n): n is number => n !== null);
  const unique = [...new Set(nums)].sort((a, b) => a - b);
  if (unique.length < 4 || unique[0] > 2) return headings;
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

function looksLikeProse(text: string): boolean {
  const t = collapseWs(text);
  if (!t) return false;
  const words = wordCount(t);
  if (words >= 40 && /[a-z]/.test(t)) return true;
  if (words >= 12 && /[a-z]/.test(t) && /[,.]/.test(t) && !/^[A-Z0-9 ,.'’:\-]+$/.test(t)) return true;
  return false;
}

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
      BARE_NUMBERED_TITLE.test(stripTocPageRef(l)) ||
      /^(#{1,3}\s+)?(chapter|глава|etymology|extracts|epilogue)\b/i.test(l),
  ).length;
  return hits / lines.length >= 0.45;
}

function parseTocEntry(line: string): string | null {
  const t = stripTocPageRef(line);
  if (!t || CONTENTS_ONLY.test(t)) return null;
  const heading = headingFromLine(t, '');
  if (heading && !isTocOrContentsTitle(heading.title)) {
    return heading.title.replace(/^Chapter\s+(?:\d+|[IVXLCDM]+)\.\s*/i, '').trim() || heading.title;
  }
  return null;
}

/** Titles listed after CONTENTS / Table of Contents, without page numbers. */
export function extractContentsTitles(text: string): string[] {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => CONTENTS_ONLY.test(l.trim().replace(/^#+\s+/, '')));
  if (start < 0) return [];

  const titles: string[] = [];
  let blanks = 0;
  for (let i = start + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) {
      blanks += 1;
      if (titles.length >= 2 && blanks >= 3) break;
      continue;
    }
    blanks = 0;
    const entry = parseTocEntry(t);
    if (entry) {
      titles.push(entry);
      continue;
    }
    if (titles.length >= 2) break;
  }
  return titles.length >= 2 ? titles : [];
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
    const heading = headingAt(lines, i);
    if (!heading && parseTocEntry(t)) {
      i += 1;
      continue;
    }
    if (!heading) break;
    const nextIdx = heading.consumeNext ? nextNonEmptyIndex(lines, i + 1) : i;
    let j = (nextIdx >= 0 && heading.consumeNext ? nextIdx : i) + 1;
    while (j < lines.length && !lines[j].trim()) j += 1;
    const nextHeading = j < lines.length ? headingAt(lines, j) : null;
    const nextToc = j < lines.length ? parseTocEntry(lines[j].trim()) : null;
    if (nextHeading || nextToc || !lines[j]?.trim()) {
      i = j;
      continue;
    }
    // Last TOC line is often followed by a slogan / title page, not chapter prose.
    let k = j;
    while (k < lines.length) {
      const line = lines[k].trim();
      if (line && (headingAt(lines, k) || parseTocEntry(line))) break;
      k += 1;
    }
    const span = lines.slice(j, k).join('\n');
    if (!looksLikeProse(span)) {
      i = k > j ? k : j + 1;
      continue;
    }
    break;
  }

  return [...lines.slice(0, start), ...lines.slice(i)].join('\n').trim();
}

/**
 * HTML / Readability often glues the next chapter onto the previous paragraph.
 * Put Gutenberg-style headings back on their own lines so line-based detection works
 * on huge books. Only split after sentence punctuation so "see Chapter 1 of" stays intact.
 */
export function ensureChapterLineBreaks(text: string): string {
  let out = text.replace(
    /([.!?…]["”'\)]{0,3}\s+)((?:#{1,3}\s+)?(?:CHAPTER|Chapter|ГЛАВА|Глава)\s+(?:\d{1,4}|[IVXLCDM]{1,8}|one|two|three|four|five|six|seven|eight|nine|ten)\s*[.:—–-]?)/gi,
    '$1\n\n$2',
  );
  // "solemnly. 2 A Lady in Distress" glued after a sentence (PDF / HTML).
  out = out.replace(
    /(?<!\b(?:No|Vol|Mr|Dr|Ms|Mrs|vs|ch|pp|Pg|pg|no|vol))([.!?…]["”'\)]{0,3})\s+(\d{1,3}|[IVXLCDM]{2,8})\s+([A-Z][\p{L}'’\-]*(?:\s+(?:[A-Z][\p{L}'’\-]+|in|on|of|the|a|an|and|at|to|for|or)){0,10})(?=\s+[“"‘']|\s+[A-Z]|\s*$)/gu,
    (full, punct: string, num: string, title: string) => {
      if (!looksLikeChapterTitle(title)) return full;
      return `${punct}\n\n${num}\n\n${title}\n\n`;
    },
  );
  return out;
}

function chaptersFromHeadings(lines: string[], headings: FoundHeading[], fallbackTitle: string): SplitChapter[] {
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
    const start = (h.consumeIndex ?? h.index) + 1;
    const end = i + 1 < headings.length ? headings[i + 1].index : lines.length;
    const bodyLines = lines.slice(start, end);
    if (h.rest) bodyLines.unshift(h.rest);
    const body = bodyLines.join('\n').trim();
    if (!body || isMostlyTocListing(body)) continue;
    chapters.push({ title: h.title.slice(0, 160), text: body });
  }

  return mergeNamedDuplicates(chapters).filter(
    (c) => !isTocOrContentsTitle(c.title) && !isMostlyTocListing(c.text),
  );
}

function scoreSplit(chapters: SplitChapter[]): number {
  if (chapters.length < 2 || !chaptersHaveRealTitles(chapters)) return 0;
  const titled = chapters.filter((c) => !/^(page|pages)\s+\d/i.test(c.title.trim())).length;
  const readable = chapters.filter((c) => /[a-z]/.test(c.title) && /Chapter\s+/i.test(c.title)).length;
  return titled * 10 + Math.min(chapters.length, 80) + readable - chapterSequenceInversions(chapters) * 40;
}

/** Count drops like XV then I — TOC leftovers / reverse PDF bookmarks. */
export function chapterSequenceInversions(chapters: Array<{ title: string }>): number {
  const nums = chapters
    .map((c) => parseChapterOrdinal(c.title))
    .filter((n): n is number => n != null);
  let inversions = 0;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i]! < nums[i - 1]!) inversions += 1;
  }
  return inversions;
}

/**
 * High-precision literary chapter split.
 * Prefers explicit chapter headings; never treats "I am…" sentences as Roman numerals.
 * Drops Gutenberg license wrappers and table-of-contents duplicates.
 */
export function splitAccurateChapters(text: string, fallbackTitle = 'Chapter 1'): SplitChapter[] {
  const prepared = stripGutenbergBoilerplate(
    ensureChapterLineBreaks(text.replace(/\r\n/g, '\n')),
  ).trim();
  if (!prepared) return [];

  const tocTitles = extractContentsTitles(prepared);
  const stripped = stripContentsListing(prepared).trim() || prepared;
  const fromToc =
    tocTitles.length >= 2 ? splitByOutlineTitles(stripped, tocTitles, fallbackTitle) : null;

  const lines = stripped.split('\n');
  const headings = preferNumberedSequence(dropTableOfContents(collectHeadings(lines))).filter(
    (h) => !isTocOrContentsTitle(h.title),
  );

  let fromHeadings: SplitChapter[] = [];
  if (headings.length >= 1) {
    fromHeadings = chaptersFromHeadings(lines, headings, fallbackTitle);
  }

  const candidates = [fromToc, fromHeadings].filter((c): c is SplitChapter[] => Boolean(c && c.length));
  candidates.sort((a, b) => scoreSplit(b) - scoreSplit(a));
  const best = candidates.find((c) => c.length >= 2 && chaptersHaveRealTitles(c)) ?? candidates[0];
  if (best?.length) return orderAndDedupChapters(best);

  return [{ title: fallbackTitle.slice(0, 160), text: stripped }];
}

/** Keep the longest body for each chapter number and restore I…XV order if a TOC leftover landed first. */
function orderAndDedupChapters(chapters: SplitChapter[]): SplitChapter[] {
  if (chapters.length < 2) return chapters;
  const items = chapters.map((c, i) => ({
    c,
    i,
    n: parseChapterOrdinal(c.title),
    words: wordCount(c.text),
  }));
  const bestByNum = new Map<number, (typeof items)[0]>();
  for (const item of items) {
    if (item.n == null) continue;
    const prev = bestByNum.get(item.n);
    if (!prev || item.words > prev.words || (item.words === prev.words && item.i > prev.i)) {
      bestByNum.set(item.n, item);
    }
  }
  const numberedOrig = items.filter((x) => x.n != null);
  const coreCap = coreOrdinalCap(numberedOrig.map((x) => x.n!));
  if (coreCap != null) {
    for (const n of [...bestByNum.keys()]) {
      if (n > coreCap + 1) bestByNum.delete(n);
    }
  }
  const disordered =
    numberedOrig.length >= 2 && numberedOrig.some((x, idx) => idx > 0 && x.n! < numberedOrig[idx - 1].n!);
  const hadDupes = numberedOrig.length !== bestByNum.size;
  if (!disordered && !hadDupes) return chapters;

  const numbered = [...bestByNum.values()].sort((a, b) => a.n! - b.n! || a.i - b.i);
  const taken = new Set(numbered.map((x) => x.i));
  const rest = items.filter((x) => x.n == null && !taken.has(x.i));
  const firstNumIdx = numbered[0]?.i ?? 0;
  const preface = rest.filter((x) => x.i < firstNumIdx);
  const after = rest.filter((x) => x.i >= firstNumIdx);
  return [...preface, ...numbered, ...after].map((x) => x.c);
}

function coreOrdinalCap(nums: number[]): number | null {
  const sorted = [...new Set(nums)].sort((a, b) => a - b);
  if (!sorted.length || sorted[0] > 2) return null;
  let cap = sorted[0];
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] > cap + 2) break;
    cap = sorted[i];
    run += 1;
  }
  return run >= 4 ? cap : null;
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
  const cleaned = titles
    .map((t) => prettyChapterTitle(stripTocPageRef(t)))
    .filter((t) => t.length >= 2 && t.length <= 120 && !isTocOrContentsTitle(t));
  if (cleaned.length < 2) return null;

  const raw = text.replace(/\r\n/g, '\n');
  const haystack = stripContentsListing(raw).trim() || raw;
  const positions: Array<{ index: number; title: string }> = [];

  for (const title of cleaned) {
    const keys = titleKeys(title);
    const idx = findTitleIndex(haystack, title, keys, 0, true);
    if (idx < 0) continue;
    if (positions.some((p) => p.index === idx)) continue;
    positions.push({ index: idx, title: prettyChapterTitle(title) });
  }

  positions.sort((a, b) => a.index - b.index);

  if (positions.length < 2 || positions.length < cleaned.length * 0.45) return null;

  const chapters: SplitChapter[] = [];
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : haystack.length;
    let body = haystack.slice(start, end).trim();
    const headingLine = body.split('\n')[0] ?? '';
    if (
      normalizeTitleKey(headingLine) === normalizeTitleKey(positions[i].title) ||
      titleKeys(headingLine).some((k) => titleKeys(positions[i].title).includes(k))
    ) {
      body = body.slice(headingLine.length).trim();
    }
    // Drop a leading isolated chapter number left above the title.
    body = body.replace(/^(?:\d{1,3}|[IVXLCDM]{1,8})\.?\s*\n+/, '');
    if (!body) continue;
    chapters.push({ title: positions[i].title.slice(0, 160), text: body });
  }

  if (chapters.length < 2) return null;
  if (positions[0].index > 0) {
    const preface = haystack.slice(0, positions[0].index).trim();
    if (preface && wordCount(preface) >= 80 && !isMostlyTocListing(preface)) {
      chapters.unshift({ title: fallbackTitle.slice(0, 160), text: preface });
    }
  }
  return orderAndDedupChapters(chapters);
}

function findTitleIndex(
  text: string,
  title: string,
  keys: string[],
  from: number,
  preferLast = false,
): number {
  const titleNorm = normalizeTitleKey(stripTocPageRef(title));
  const allowSubstring = titleNorm.length >= 12 || titleNorm.split(' ').length >= 3;
  const lines = text.split('\n');
  let offset = 0;
  let last = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStart = offset;
    offset += line.length + 1;
    if (lineStart + line.length < from) continue;

    const stripped = stripTocPageRef(line);
    const collapsed = normalizeTitleKey(stripped);
    const nextCollapsed = normalizeTitleKey(stripTocPageRef(lines[i + 1] ?? ''));
    const combined = collapseWs(`${collapsed} ${nextCollapsed}`);
    if (!collapsed) continue;
    const numbered = collapsed.match(/^(?:\d+|[ivxlcdm]+)\s+(.+)$/);
    const hit =
      collapsed === titleNorm ||
      keys.includes(collapsed) ||
      combined === titleNorm ||
      keys.includes(combined) ||
      Boolean(numbered && (numbered[1] === titleNorm || keys.includes(numbered[1])));
    if (!hit) continue;
    last = lineStart;
    if (!preferLast) return last;
  }

  if (last >= 0) return last;
  if (!allowSubstring) return -1;
  if (preferLast) {
    const needle = title.toLowerCase();
    let idx = text.toLowerCase().indexOf(needle, from);
    let found = -1;
    while (idx >= 0) {
      found = idx;
      idx = text.toLowerCase().indexOf(needle, idx + Math.max(needle.length, 1));
    }
    return found;
  }
  const direct = text.toLowerCase().indexOf(title.toLowerCase(), from);
  return direct >= 0 ? direct : -1;
}
