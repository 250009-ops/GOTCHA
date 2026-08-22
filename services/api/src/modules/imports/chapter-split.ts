import { isOcrImageJunkLine, stripOcrImageJunk } from './import-text-cleaner';
import { isDialogueLine } from './dialogue-layout';

export { isDialogueLine } from './dialogue-layout';

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
const CONTENTS_ONLY = /^(contents|table of contents|c[o0]n[tf]ents)\.?$/i;
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
  const pronoun = t.match(/^(i|we|you|he|she|they|it)\s+(\S)/i);
  if (pronoun && /^[a-z]/.test(pronoun[2])) return true;
  if (t.length > 48 && /[,;]/.test(t)) return true;
  if (t.length > 70) return true;
  return false;
}

/** I / I'm / I’m at the start of a printed heading, not a spoken sentence. */
const FIRST_PERSON_TITLE_OPEN = /^I(?:['’]m|['’]d|['’]ll| am)?\s+/u;

/** Printed titles like "I Find Elaine Garfield" / "I'm Sorry, Mr Samuel". */
export function looksLikeFirstPersonTitle(line: string): boolean {
  const t = collapseWs(stripTocPageRef(line));
  if (!t || isDialogueLine(t)) return false;
  if (!FIRST_PERSON_TITLE_OPEN.test(t)) return false;
  if (!/^I(?:['’]m|['’]d|['’]ll| am)?\s+[\p{Lu}]/u.test(t)) return false;
  if (t.length > 70) return false;
  const words = t.split(/\s+/);
  if (words.length < 2 || words.length > 10) return false;
  return looksLikeTitleLine(t);
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

function isGarbageHeadingText(line: string): boolean {
  const t = collapseWs(line);
  if (!t) return true;
  if (isOcrImageJunkLine(t)) return true;
  const symbols = (t.match(/[/\\|\[\]{}<>;]+/g) || []).join('').length;
  if (symbols >= 3) return true;
  const letters = (t.match(/\p{L}/gu) || []).length;
  if (letters >= 8 && letters / Math.max(t.replace(/\s+/g, '').length, 1) < 0.55) return true;
  return false;
}

/** Arabic 1–200, or roman I–C. Never "DI" / "MIX" crossword leftovers. */
function isPlausibleChapterToken(token: string): boolean {
  const t = collapseWs(token);
  if (/^\d{1,4}$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 200;
  }
  if (!/^[IVXLCDM]+$/i.test(t)) return false;
  if (/[DM]/i.test(t)) return false;
  const n = romanToInt(t);
  return n != null && n >= 1 && n <= 100;
}

function looksLikeChapterTitle(line: string): boolean {
  const t = stripTocPageRef(line).replace(/\s*\(_?\s*(?:contd\.?|continued)_?\s*\)\s*$/i, '');
  if (isDialogueLine(t) || isDialogueLine(line)) return false;
  if (isGarbageHeadingText(t) || isGarbageHeadingText(line)) return false;
  if (looksLikeFirstPersonTitle(t) || looksLikeFirstPersonTitle(line)) return true;
  if (!looksLikeTitleLine(t) && !looksLikeTitleLine(line)) return false;
  const probe = looksLikeTitleLine(t) ? t : stripTocPageRef(line);
  if (/^[(_[]/.test(probe)) return false;
  // Prose openers ("what she said") — keep Title Case names ("What Happened Next").
  if (/^(i|we|you|he|she|they|it|call|there|this|that|if|as)\s+[a-z]/i.test(probe)) {
    return false;
  }
  if (/^(what|when|where|why|how)\s+[a-z]/i.test(probe) && !/^(What|When|Where|Why|How)\b/.test(probe)) {
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
  if (isDialogueLine(raw)) return null;
  if (IMAGE_CAPTION.test(raw) || isOcrImageJunkLine(raw)) return null;

  const md = raw.match(MARKDOWN_HEADING);
  if (md) {
    const inner = collapseWs(md[2]);
    if (!inner || isEnglishSentence(inner)) return null;
    const nested = headingFromLine(inner, nextLine);
    return nested ?? { title: prettyChapterTitle(inner), consumeNext: false, kind: 'explicit' };
  }

  const numbered = raw.match(NUMBERED_CHAPTER);
  if (numbered) {
    if (!isPlausibleChapterToken(numbered[1])) return null;
    const rest = collapseWs(numbered[2] || '');
    if (rest) {
      // Cetology-style asides: "CHAPTER I. (_Folio_), CHAPTER II. (_Right Whale_)."
      if (/^[(_]/.test(rest)) return null;
      if (isGarbageHeadingText(rest)) return null;
      if (isEnglishSentence(rest) && rest.length > 60) return null;
      const title = prettyChapterTitle(`Chapter ${numbered[1]}. ${rest}`);
      return { title, consumeNext: false, kind: 'explicit' };
    }
    // "CHAPTER XV." with the name on the next line — handled below as ONLY.
  }

  const only = raw.match(NUMBERED_CHAPTER_ONLY);
  if (only) {
    if (!isPlausibleChapterToken(only[1])) return null;
    const next = nextLine?.trim() ?? '';
    if (isGarbageHeadingText(next)) {
      return { title: prettyChapterTitle(`Chapter ${only[1]}`), consumeNext: false, kind: 'explicit' };
    }
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
    // Lone "I" is first-person English, not Chapter I. Use explicit "Chapter I." instead.
    if (token === 'I') return null;
    if (!isPlausibleChapterToken(token)) return null;
    if (isDialogueLine(next) || isGarbageHeadingText(next)) return null;
    if (next && looksLikeChapterTitle(next) && !NUMBERED_CHAPTER.test(next)) {
      return { title: prettyChapterTitle(`Chapter ${token}. ${next}`), consumeNext: true, kind: 'inferred' };
    }
    return { title: prettyChapterTitle(`Chapter ${token}`), consumeNext: false, kind: 'inferred' };
  }

  if (ISOLATED_NUMBER.test(raw)) {
    const next = nextLine?.trim() ?? '';
    if (next && !isDialogueLine(next) && looksLikeChapterTitle(next) && !isEnglishSentence(next)) {
      return {
        title: prettyChapterTitle(`Chapter ${raw.replace('.', '')}. ${next}`),
        consumeNext: true,
        kind: 'inferred',
      };
    }
  }

  const bare = raw.match(BARE_NUMBERED_TITLE);
  if (bare) {
    const token = String(bare[1]);
    const rest = collapseWs(bare[2] || '');
    if (!isPlausibleChapterToken(token)) return null;
    if (/^I$/i.test(token) && !/^\s*[.:—–-]/.test(raw.slice(raw.search(/I/i) + 1))) {
      return null;
    }
    if (isGarbageHeadingText(rest)) return null;
    if (rest && !isDialogueLine(rest) && looksLikeChapterTitle(rest) && !isEnglishSentence(rest)) {
      return {
        title: prettyChapterTitle(`Chapter ${token}. ${rest}`),
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
  if (FIRST_PERSON_TITLE_OPEN.test(t) && !/^chapter\s+I\b/i.test(t) && !/^I\./.test(t)) {
    return null;
  }
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

function parseTocEntry(line: string, nextLine = ''): string | null {
  const t = stripTocPageRef(line);
  if (!t || CONTENTS_ONLY.test(t) || isOcrImageJunkLine(t) || isDialogueLine(t)) return null;
  const heading = headingFromLine(t, nextLine);
  if (heading && !isTocOrContentsTitle(heading.title)) {
    return heading.title;
  }
  return null;
}

type PrintTocEntry = { ordinal: number; title: string };
type PrintToc = {
  entries: PrintTocEntry[];
  coverEnd: number;
  listingEnd: number;
};

/** Graded-reader Contents: "1 A Visitor 4" not Gutenberg "CHAPTER 1. Loomings". */
function normalizeOcrTocLine(line: string): string {
  let t = collapseWs(line);
  // OCR often reads "1 A Visitor 4" as "I A Visitor 4" / "l A Visitor 4".
  // Do not rewrite real first-person titles ("I Find Elaine Garfield 53").
  if (/^[Il|]\s+(?:A|An|The)\s+[\p{Lu}]/u.test(t)) {
    t = t.replace(/^[Il|]\s+/, '1 ');
  }
  t = t.replace(/^(\d{1,3})([\p{Lu}])/u, '$1 $2');
  return t;
}

function splitGluedTocLine(line: string): string[] {
  const t = normalizeOcrTocLine(line);
  const matches = [
    ...t.matchAll(
      /(\d{1,3})[.)]?\s+([\p{Lu}][\p{L}'’\-]*(?:\s+(?:[\p{Lu}][\p{L}'’\-]*|in|on|of|the|a|an|and|at|to|for|or|mr|my|i'm|i’m)){0,10})\s+(\d{1,3})(?=\s+\d{1,3}[.)]?\s+[\p{Lu}]|$)/giu,
    ),
  ];
  if (matches.length >= 2) {
    return matches.map((m) => `${m[1]} ${m[2]} ${m[3]}`);
  }
  return [t];
}

function isPrintTocLine(line: string): boolean {
  const t = stripTocPageRef(normalizeOcrTocLine(line));
  if (!t || /^chapter\s+/i.test(t)) return false;
  return /^(?:#{1,3}\s+)?\d{1,3}[.)]?\s+[\p{Lu}]/u.test(t);
}

function extrasSectionTitle(text: string): string {
  const sample = text.slice(0, 500);
  if (/points for understanding/i.test(sample)) return 'Points for Understanding';
  if (/multiple choice/i.test(sample)) return 'Multiple Choice';
  if (/find words in the square/i.test(sample)) return 'Activities';
  const first = text
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !isOcrImageJunkLine(l) && !/^\d{1,3}\.?$/.test(l));
  if (first && looksLikeChapterTitle(first) && first.length <= 80 && !isDialogueLine(first)) {
    return prettyChapterTitle(first);
  }
  return 'Activities';
}

const EXTRAS_MARK =
  /(?:^|\n)[ \t]*(Points for Understanding|Multiple Choice|Tick the best answer|Find words in the square|After reading)\b/i;

function splitOffExtras(body: string): { story: string; extras: string } {
  const m = body.match(EXTRAS_MARK);
  if (!m || m.index == null || m.index < 40) return { story: body, extras: '' };
  return {
    story: body.slice(0, m.index).trim(),
    extras: stripOcrImageJunk(body.slice(m.index)).trim(),
  };
}

function collectPrintTocEntries(lines: string[], start: number): { entries: PrintTocEntry[]; end: number } {
  const entries: PrintTocEntry[] = [];
  let misses = 0;
  let i = start;
  while (i < lines.length) {
    const rawLine = lines[i].trim();
    if (!rawLine) {
      i += 1;
      if (entries.length >= 4 && misses >= 2) break;
      continue;
    }
    if (isOcrImageJunkLine(rawLine) || isDialogueLine(rawLine)) {
      misses += 1;
      i += 1;
      if (entries.length >= 4 && misses >= 3) break;
      continue;
    }
    const chunks = splitGluedTocLine(rawLine);
    let accepted = 0;
    let consumeExtra = 0;
    for (let c = 0; c < chunks.length; c++) {
      const t = stripTocPageRef(chunks[c]);
      const next =
        c + 1 < chunks.length ? chunks[c + 1] : (lines[i + 1]?.trim() ?? '');
      const heading = headingFromLine(t, next);
      const ordinal = heading ? parseChapterOrdinal(heading.title) : null;
      const printLike =
        isPrintTocLine(t) ||
        (ISOLATED_NUMBER.test(t) && looksLikeChapterTitle(next) && !isDialogueLine(next));
      if (heading && ordinal != null && ordinal >= 1 && printLike) {
        const prev = entries[entries.length - 1];
        if (prev && ordinal < prev.ordinal) {
          return { entries, end: i };
        }
        entries.push({ ordinal, title: heading.title });
        accepted += 1;
        misses = 0;
        if (chunks.length === 1 && heading.consumeNext) consumeExtra = 1;
      }
    }
    if (accepted > 0) {
      i += 1 + consumeExtra;
      continue;
    }
    if (looksLikeProse(rawLine) && rawLine.length > 60) break;
    misses += 1;
    i += 1;
    if (entries.length >= 4 && misses >= 3) break;
    if (entries.length < 2 && misses >= 12) break;
  }
  return { entries, end: i };
}

function charOffsetAtLine(lines: string[], lineIndex: number): number {
  let offset = 0;
  for (let i = 0; i < lineIndex && i < lines.length; i++) {
    offset += lines[i].length + 1;
  }
  return offset;
}

/** Printed Contents with 1, 2, 3… titles — the chapter map for graded readers. */
export function extractPrintContents(text: string): PrintToc | null {
  const lines = text.split('\n');
  let start = lines.findIndex((l) => CONTENTS_ONLY.test(l.trim().replace(/^#+\s+/, '')));
  if (start < 0) {
    start = lines.findIndex((l, idx) => idx < 400 && isPrintTocLine(l));
    if (start < 0) return null;
    start = Math.max(0, start - 1);
  }
  const collected = collectPrintTocEntries(lines, start + (CONTENTS_ONLY.test(lines[start]?.trim().replace(/^#+\s+/, '') ?? '') ? 1 : 0));
  if (collected.entries.length < 4) return null;
  const nums = collected.entries.map((e) => e.ordinal);
  if (nums[0] > 2) return null;
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] < nums[i - 1]) return null;
  }
  return {
    entries: collected.entries,
    coverEnd: charOffsetAtLine(lines, start),
    listingEnd: charOffsetAtLine(lines, collected.end),
  };
}

function splitByPrintContents(text: string, toc: PrintToc, fallbackTitle: string): SplitChapter[] | null {
  const chapters: SplitChapter[] = [];
  let from = toc.listingEnd;
  const positions: Array<{ index: number; title: string }> = [];

  for (const entry of toc.entries) {
    const keys = titleKeys(entry.title);
    const idx = findTitleIndex(text, entry.title, keys, from, false);
    if (idx < 0 || idx < toc.listingEnd) continue;
    if (positions.some((p) => Math.abs(p.index - idx) < 2)) continue;
    positions.push({ index: idx, title: entry.title });
    from = idx + Math.max(entry.title.length, 1);
  }

  // Title-page OCR often misses Chapter 1; the story after Contents is still that chapter.
  if (positions.length) {
    const firstOrd = parseChapterOrdinal(positions[0].title);
    if (firstOrd != null && firstOrd >= 2 && positions[0].index > toc.listingEnd + 8) {
      const lead = toc.entries.filter((e) => e.ordinal < firstOrd);
      const gap = text.slice(toc.listingEnd, positions[0].index).trim();
      if (lead.length && gap && wordCount(gap) >= 8) {
        const placed: Array<{ index: number; title: string }> = [];
        let gapFrom = toc.listingEnd;
        for (const entry of lead) {
          const keys = titleKeys(entry.title);
          const idx = findTitleIndex(text, entry.title, keys, gapFrom, false);
          if (idx >= toc.listingEnd && idx < positions[0].index) {
            placed.push({ index: idx, title: entry.title });
            gapFrom = idx + Math.max(entry.title.length, 1);
          }
        }
        if (placed.length) {
          positions.unshift(...placed);
          positions.sort((a, b) => a.index - b.index);
        } else {
          positions.unshift({ index: toc.listingEnd, title: lead[0].title });
        }
      }
    }
  }

  if (positions.length < 2 || positions.length < toc.entries.length * 0.3) return null;

  const cover = text.slice(0, toc.coverEnd).trim();
  if (cover && wordCount(cover) >= 8) {
    chapters.push({ title: 'Cover', text: cover });
  }
  const listing = text.slice(toc.coverEnd, toc.listingEnd).trim();
  if (listing && wordCount(listing) >= 4) {
    chapters.push({ title: 'Contents', text: listing });
  }

  let extras = '';
  for (let i = 0; i < positions.length; i++) {
    const start = positions[i].index;
    const end = i + 1 < positions.length ? positions[i + 1].index : text.length;
    let body = text.slice(start, end).trim();
    const headingLine = body.split('\n')[0] ?? '';
    if (
      normalizeTitleKey(headingLine) === normalizeTitleKey(positions[i].title) ||
      titleKeys(headingLine).some((k) => titleKeys(positions[i].title).includes(k))
    ) {
      body = body.slice(headingLine.length).trim();
    }
    body = body.replace(/^(?:\d{1,3}|[IVXLCDM]{1,8})\.?\s*\n+/, '');
    const titleLine = body.split('\n')[0] ?? '';
    if (titleKeys(titleLine).some((k) => titleKeys(positions[i].title).includes(k))) {
      body = body.slice(titleLine.length).trim();
    }
    if (i === positions.length - 1) {
      const split = splitOffExtras(body);
      body = split.story;
      extras = split.extras;
    }
    if (!body) continue;
    chapters.push({ title: positions[i].title.slice(0, 160), text: body });
  }

  if (extras && wordCount(extras) >= 15) {
    chapters.push({ title: extrasSectionTitle(extras), text: extras });
  }

  return chapters.length >= 2 ? chapters : null;
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
    const entry = parseTocEntry(t, lines[i + 1] ?? '');
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
    if (!heading && parseTocEntry(t, lines[i + 1] ?? '')) {
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
      const firstNum = parseChapterOrdinal(first.title);
      const title =
        firstNum === 2
          ? prettyChapterTitle('Chapter 1')
          : fallbackTitle.slice(0, 160);
      chapters.push({ title, text: preface });
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
  const prepared = stripOcrImageJunk(
    stripGutenbergBoilerplate(ensureChapterLineBreaks(text.replace(/\r\n/g, '\n'))),
  ).trim();
  if (!prepared) return [];

  const printToc = extractPrintContents(prepared);
  if (printToc && printToc.entries.length >= 4) {
    const graded = splitByPrintContents(prepared, printToc, fallbackTitle);
    if (graded && graded.length >= 3) return graded;
  }

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
    const prefixHit =
      titleNorm.split(' ').length >= 2 &&
      (collapsed === titleNorm ||
        collapsed.startsWith(`${titleNorm} `) ||
        combined.startsWith(`${titleNorm} `));
    const hit =
      prefixHit ||
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
