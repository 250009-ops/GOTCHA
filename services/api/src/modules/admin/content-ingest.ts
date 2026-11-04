import { tokenizeText, paginateText, uniqueWordCount } from '../../utils/tokenizer';
import { safeFetch } from '../../common/safe-fetch';
import {
  extractTextFromPdf,
  extractTextFromEpub,
  extractTextFromUrl,
  type ExtractedChapter,
} from '../imports/extract-text';
import { chaptersHaveRealTitles, splitAccurateChapters } from '../imports/chapter-split';
import { preparePastedText } from '../imports/import-text-cleaner';

const FRONT_MATTER_TITLE = /^(copyright|isbn|colophon|legal)$/i;

const FRONT_MATTER_MARKERS = [
  'all rights reserved',
  'isbn',
  'library of congress',
  'no part of this publication',
  'no part of this book',
  'reproduced or transmitted',
];

function countWords(text: string) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

export function isFrontMatterChapter(title: string, text: string) {
  const heading = title.trim();
  if (FRONT_MATTER_TITLE.test(heading)) return true;
  const sample = `${heading}\n${text.slice(0, 900)}`.toLowerCase();
  const hits = FRONT_MATTER_MARKERS.filter((m) => sample.includes(m)).length;
  return hits >= 3 && countWords(text) < 200;
}

/** Book/story chapter split: real headings only, copyright/front matter dropped. */
export function splitLiteraryChapters(text: string, fallbackTitle = 'Chapter 1'): ExtractedChapter[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const chapters = splitAccurateChapters(normalized, fallbackTitle).filter(
    (c) => !isFrontMatterChapter(c.title, c.text),
  );
  if (chapters.length) return chapters;
  return [{ title: fallbackTitle, text: normalized }];
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
    .filter((c) => c.text.length > 0);

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

function finalizeExtractedDoc(
  doc: { text?: string; chapters: ExtractedChapter[]; detectedTitle?: string },
  fallbackTitle: string,
): { title?: string; chapters: ExtractedChapter[]; text: string } {
  const title = doc.detectedTitle || fallbackTitle;
  const text = doc.text || doc.chapters.map((c) => c.text).join('\n\n');
  const chapters = resolveLiteraryChapters(doc.chapters, title, text);
  return { title, text, chapters };
}

/** Keep real chapter titles; otherwise re-split the full text on printed headings / contents. */
export function resolveLiteraryChapters(
  chapters: ExtractedChapter[],
  fallbackTitle: string,
  fullText?: string,
): ExtractedChapter[] {
  const cleaned = chapters
    .map((c) => ({
      title: (c.title || fallbackTitle).trim() || fallbackTitle,
      text: c.text.trim(),
    }))
    .filter((c) => c.text.length > 0);
  if (chaptersHaveRealTitles(cleaned)) {
    return cleaned;
  }
  const joined = (fullText || cleaned.map((c) => c.text).join('\n\n')).trim();
  if (!joined) return cleaned;
  return splitLiteraryChapters(joined, fallbackTitle);
}

export async function extractSourceDocument(opts: {
  plainText?: string;
  sourceUrl?: string;
  title?: string;
  pdfBuffer?: Buffer;
  language?: string;
}): Promise<{ title?: string; chapters: ExtractedChapter[]; text: string }> {
  const title = opts.title?.trim() || 'Untitled';
  const pasted = preparePastedText(opts.plainText ?? '');
  if (pasted) {
    return {
      title,
      text: pasted,
      chapters: splitLiteraryChapters(pasted, title),
    };
  }
  if (opts.pdfBuffer?.length) {
    const doc = await extractTextFromPdf(opts.pdfBuffer, { language: opts.language });
    return finalizeExtractedDoc(doc, title);
  }
  const url = opts.sourceUrl?.trim();
  if (url) {
    if (/\.pdf(\?|#|$)/i.test(url)) {
      const res = await safeFetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`Could not download PDF (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const doc = await extractTextFromPdf(buf, { language: opts.language });
      return finalizeExtractedDoc(doc, title);
    }
    if (/\.epub(\?|#|$)/i.test(url)) {
      const res = await safeFetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!res.ok) throw new Error(`Could not download EPUB (${res.status})`);
      const buf = Buffer.from(await res.arrayBuffer());
      const doc = await extractTextFromEpub(buf);
      return finalizeExtractedDoc(doc, title);
    }
    const doc = await extractTextFromUrl(url);
    return finalizeExtractedDoc(doc, title);
  }

  return { title, text: '', chapters: [] };
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
