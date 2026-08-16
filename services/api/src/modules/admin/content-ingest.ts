import { tokenizeText, paginateText, uniqueWordCount } from '../../utils/tokenizer';
import {
  extractTextFromPdf,
  extractTextFromUrl,
  splitTextIntoChapters,
  type ExtractedChapter,
} from '../imports/extract-text';

const FRONT_MATTER_TITLE =
  /^(copyright|contents|table of contents|title page|dedication|acknowledg|foreword|preface|isbn|colophon|legal|credits|about the author)$/i;

const FRONT_MATTER_MARKERS = [
  'all rights reserved',
  'copyright',
  '©',
  'isbn',
  'library of congress',
  'no part of this publication',
  'no part of this book',
  'reproduced or transmitted',
  'published by',
  'first published',
  'printed in',
  'table of contents',
];

const CHAPTER_HEADING =
  /^(chapter|глава|bob|qism|часть|part|section)\s+[\divxlc0-9]+(?:\b|[.:—–-])/i;

function countWords(text: string) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

export function isFrontMatterChapter(title: string, text: string) {
  const heading = title.trim();
  if (FRONT_MATTER_TITLE.test(heading)) return true;
  const sample = `${heading}\n${text.slice(0, 900)}`.toLowerCase();
  const hits = FRONT_MATTER_MARKERS.filter((m) => sample.includes(m)).length;
  return hits >= 2 && countWords(text) < 450;
}

function isLiteraryHeading(line: string): string | null {
  const t = line.trim();
  if (!t || t.length > 120) return null;
  const md = t.match(/^#{1,3}\s+(.+)$/);
  if (md) return md[1].trim();
  if (CHAPTER_HEADING.test(t)) return t;
  if (/^\d{1,3}[-.]?\s*bob\b/i.test(t)) return t;
  if (/^[IVXLCDM]{1,8}\.?\s+\S/.test(t) && t.length < 80 && !/[.!?]$/.test(t)) return t;
  if (/^[A-Z0-9][A-Z0-9 \-:'"]{8,80}$/.test(t) && !/[.!?]$/.test(t) && CHAPTER_HEADING.test(t)) {
    return t;
  }
  return null;
}

/** Book/story chapter split: real headings only, copyright/front matter dropped. */
export function splitLiteraryChapters(text: string, fallbackTitle = 'Chapter 1'): ExtractedChapter[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const chapters: ExtractedChapter[] = [];
  let currentTitle = fallbackTitle;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    buffer = [];
    if (!body) return;
    if (isFrontMatterChapter(currentTitle, body)) return;
    chapters.push({ title: currentTitle.slice(0, 160), text: body });
  };

  for (const line of lines) {
    const heading = isLiteraryHeading(line);
    if (heading) {
      if (buffer.length > 0) flush();
      currentTitle = heading;
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (chapters.length >= 2) return chapters;

  const heuristic = splitTextIntoChapters(normalized, fallbackTitle).filter(
    (c) => !isFrontMatterChapter(c.title, c.text),
  );
  if (heuristic.length >= 2) return heuristic;
  const body = heuristic[0]?.text || normalized;
  if (!body.trim()) return [];
  return [{ title: fallbackTitle, text: body }];
}

export type BuiltSegment = {
  segmentIndex: number;
  chapterIndex: number;
  chapterTitle: string;
  pageIndex: number;
  title: string;
  plainText: string;
  tokenMap: unknown;
  sentenceMap: unknown;
  wordCount: number;
};

export function buildSegmentsFromChapters(
  chapters: ExtractedChapter[],
  mode: 'literary' | 'tight',
): BuiltSegment[] {
  const cleaned = chapters
    .map((c) => ({ title: c.title.trim() || 'Chapter', text: c.text.trim() }))
    .filter((c) => c.text.length > 0 && !isFrontMatterChapter(c.title, c.text));

  const segments: BuiltSegment[] = [];

  if (mode === 'tight') {
    const text = cleaned.map((c) => c.text).join('\n\n').trim();
    if (!text) return [];
    const { tokenMap, sentenceMap, wordCount } = tokenizeText(text);
    segments.push({
      segmentIndex: 0,
      chapterIndex: 0,
      chapterTitle: cleaned[0]?.title || 'Content',
      pageIndex: 0,
      title: cleaned[0]?.title || 'Content',
      plainText: text,
      tokenMap,
      sentenceMap,
      wordCount,
    });
    return segments;
  }

  cleaned.forEach((chapter, chapterIndex) => {
    const pages = paginateText(chapter.text);
    pages.forEach((page, pageIndex) => {
      const { tokenMap, sentenceMap, wordCount } = tokenizeText(page.plainText);
      segments.push({
        segmentIndex: segments.length,
        chapterIndex,
        chapterTitle: chapter.title.slice(0, 160),
        pageIndex,
        title:
          pages.length === 1
            ? chapter.title.slice(0, 200)
            : `${chapter.title} · ${page.title}`.slice(0, 200),
        plainText: page.plainText,
        tokenMap,
        sentenceMap,
        wordCount,
      });
    });
  });

  return segments;
}

export function segmentStats(segments: BuiltSegment[]) {
  const wordCount = segments.reduce((sum, s) => sum + s.wordCount, 0);
  const tokenMap = segments.flatMap((s) => s.tokenMap as never[]);
  return {
    wordCount,
    uniqueWordCount: uniqueWordCount(tokenMap as never),
  };
}

export async function extractSourceDocument(opts: {
  plainText?: string;
  sourceUrl?: string;
  title?: string;
}): Promise<{ title?: string; chapters: ExtractedChapter[]; text: string }> {
  const title = opts.title?.trim() || 'Untitled';
  const url = opts.sourceUrl?.trim();
  if (url) {
    if (/\.pdf(\?|#|$)/i.test(url)) {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(60_000) });
      if (!res.ok) throw new Error(`Could not download PDF (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const doc = await extractTextFromPdf(buf);
      const text = doc.chapters.map((c) => c.text).join('\n\n');
      return {
        title: doc.detectedTitle || title,
        text,
        chapters: splitLiteraryChapters(text, doc.detectedTitle || title),
      };
    }
    const doc = await extractTextFromUrl(url);
    const text = doc.text || doc.chapters.map((c) => c.text).join('\n\n');
    return {
      title: doc.detectedTitle || title,
      text,
      chapters: splitLiteraryChapters(text, doc.detectedTitle || title),
    };
  }

  const plain = (opts.plainText ?? '').trim();
  if (!plain) return { title, text: '', chapters: [] };
  return {
    title,
    text: plain,
    chapters: splitLiteraryChapters(plain, title),
  };
}

export function previewFromSegments(segments: BuiltSegment[]) {
  const chapters: Array<{
    title: string;
    chapterIndex: number;
    wordCount: number;
    pages: Array<{ pageIndex: number; title: string; wordCount: number; preview: string }>;
  }> = [];
  for (const seg of segments) {
    let ch = chapters.find((c) => c.chapterIndex === seg.chapterIndex);
    if (!ch) {
      ch = { title: seg.chapterTitle, chapterIndex: seg.chapterIndex, wordCount: 0, pages: [] };
      chapters.push(ch);
    }
    ch.wordCount += seg.wordCount;
    ch.pages.push({
      pageIndex: seg.pageIndex,
      title: `Page ${seg.pageIndex + 1}`,
      wordCount: seg.wordCount,
      preview: seg.plainText.slice(0, 140),
    });
  }
  return chapters;
}
