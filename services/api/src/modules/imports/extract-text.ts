import { PDFParse, PasswordException } from 'pdf-parse';
import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import {
  cleanImportPlainText,
  cleanPdfPageText,
  htmlToCleanText,
  normalizeImportWhitespace,
  stripRepeatedPdfHeadersFooters,
} from './import-text-cleaner';

export const MIN_IMPORT_WORDS = 50;
/** Paste / extracted text hard cap — reject only above this with a clear error. */
export const MAX_IMPORT_CHARS = 500_000;
/** Soft cap for a single extracted document before chapter packing. */
export const MAX_EXTRACTED_CHARS = 500_000;
export const MAX_FILE_BYTES = 40 * 1024 * 1024;
/** OCR only the first N pages of scanned PDFs (keeps sync path practical). */
export const OCR_MAX_PAGES = 8;
/** Trigger OCR when extracted text is thinner than this many words per page on average. */
export const OCR_WORDS_PER_PAGE_THRESHOLD = 15;

export interface ExtractedChapter {
  title: string;
  text: string;
}

export interface ExtractedDocument {
  text: string;
  chapters: ExtractedChapter[];
  detectedTitle?: string;
  usedOcr?: boolean;
  pageCount?: number;
}

export function countWords(text: string): number {
  const m = text.trim().match(/[\p{L}\p{M}']+/gu);
  return m?.length ?? 0;
}

/** @deprecated Prefer htmlToCleanText — kept for callers that need a simple tag strip. */
export function stripHtml(html: string): string {
  return htmlToCleanText(html);
}

function normalizeWhitespace(text: string): string {
  return normalizeImportWhitespace(text);
}

function clampText(text: string, max = MAX_EXTRACTED_CHARS): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trim();
}

export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+/g, '/').replace(/\/$/, '');
    const last = path.split('/').filter(Boolean).pop();
    if (last) {
      return (
        decodeURIComponent(last)
          .replace(/\.[a-z0-9]{1,5}$/i, '')
          .replace(/[-_]+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 120) || u.hostname
      );
    }
    return u.hostname;
  } catch {
    return 'Imported URL';
  }
}

export function assertMinWords(text: string, label = 'text'): void {
  const words = countWords(text);
  if (words < MIN_IMPORT_WORDS) {
    throw new Error(
      words === 0
        ? `No extractable ${label} found`
        : `Need at least ${MIN_IMPORT_WORDS} words (found ${words})`,
    );
  }
}

export function assertMaxChars(text: string, label = 'text'): void {
  if (text.length > MAX_IMPORT_CHARS) {
    throw new Error(
      `${label} is too long (${text.length.toLocaleString()} characters). Maximum is ${MAX_IMPORT_CHARS.toLocaleString()} characters.`,
    );
  }
}

/**
 * Split long paste / plain text into chapter-like segments using heading heuristics.
 * Falls back to a single chapter when no structure is found (paginateText handles pages).
 */
export function splitTextIntoChapters(text: string, fallbackTitle = 'Imported text'): ExtractedChapter[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];

  const lines = normalized.split('\n');
  const chapters: ExtractedChapter[] = [];
  let currentTitle = fallbackTitle;
  let buffer: string[] = [];

  const flush = () => {
    const body = buffer.join('\n').trim();
    if (!body) return;
    chapters.push({ title: currentTitle.slice(0, 120), text: body });
    buffer = [];
  };

  const isHeading = (line: string): string | null => {
    const t = line.trim();
    if (!t || t.length > 120) return null;
    const md = t.match(/^#{1,3}\s+(.+)$/);
    if (md) return md[1].trim();
    if (/^(chapter|part|section|book)\s+[\divxlc0-9]+/i.test(t)) return t;
    if (/^[A-Z0-9][A-Z0-9 \-:'"]{8,80}$/.test(t) && !/[.!?]$/.test(t)) return t;
    return null;
  };

  for (const line of lines) {
    const heading = isHeading(line);
    if (heading && buffer.length > 0) {
      flush();
      currentTitle = heading;
      continue;
    }
    if (heading && buffer.length === 0) {
      currentTitle = heading;
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (chapters.length <= 1) {
    return [{ title: fallbackTitle, text: normalized }];
  }
  return chapters;
}

function chaptersToDocument(
  chapters: ExtractedChapter[],
  detectedTitle?: string,
  extras?: Partial<ExtractedDocument>,
): ExtractedDocument {
  const cleaned = chapters
    .map((c) => ({
      title: c.title.slice(0, 120),
      text: cleanImportPlainText(c.text),
    }))
    .filter((c) => c.text.length > 0);
  let remaining = MAX_EXTRACTED_CHARS;
  const capped: ExtractedChapter[] = [];
  for (const c of cleaned) {
    if (remaining <= 0) break;
    const text = c.text.length > remaining ? c.text.slice(0, remaining).trim() : c.text;
    if (!text) break;
    capped.push({ title: c.title, text });
    remaining -= text.length;
  }
  const text = capped.map((c) => c.text).join('\n\n');
  return { text, chapters: capped.length ? capped : [{ title: 'Imported text', text }], detectedTitle, ...extras };
}

function htmlToReadable(html: string, url: string): { text: string; title?: string } {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    // Prefer Readability's HTML fragment so tables/images can be converted properly.
    if (article?.content && countWords(article.textContent || '') >= MIN_IMPORT_WORDS) {
      const text = htmlToCleanText(article.content);
      if (countWords(text) >= MIN_IMPORT_WORDS) {
        return {
          text,
          title: article.title?.trim() || undefined,
        };
      }
    }
  } catch {
    // fall through to cheerio path
  }

  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().replace(/\s+/g, ' ').trim() ||
    undefined;
  const mainHtml =
    $('article').html() ||
    $('main').html() ||
    $('[role="main"]').html() ||
    $('.mw-parser-output').html() ||
    $('.post-content, .entry-content, .article-body, #content, #mw-content-text').first().html() ||
    $('body').html() ||
    html;
  return { text: htmlToCleanText(mainHtml), title };
}

function mapFetchError(err: unknown, status?: number): Error {
  if (status === 401 || status === 403) {
    return new Error(
      'This page blocked access (login wall, paywall, or forbidden). Try paste or a publicly readable URL.',
    );
  }
  if (status === 404) return new Error('URL not found (HTTP 404).');
  if (status === 429) return new Error('The site rate-limited the request. Try again in a few minutes.');
  if (status && status >= 400) return new Error(`Could not fetch URL (HTTP ${status}).`);

  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
  const message = err instanceof Error ? err.message : String(err);
  if (name === 'TimeoutError' || /aborted|timeout/i.test(message)) {
    return new Error('Timed out fetching the URL. The site may be slow or blocking automated requests.');
  }
  if (/ENOTFOUND|ECONNREFUSED|ECONNRESET|certificate|SSL/i.test(message)) {
    return new Error('Could not reach the URL (network or TLS error).');
  }
  return new Error(message || 'URL import failed');
}

export async function extractTextFromUrl(url: string): Promise<ExtractedDocument> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; GotchaImporter/2.0; +https://gotcha.app) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30_000),
    });
  } catch (err) {
    throw mapFetchError(err);
  }

  if (!response.ok) {
    throw mapFetchError(undefined, response.status);
  }

  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const body = await response.text();

  if (contentType.includes('text/plain') || /\.txt(\?|$)/i.test(url)) {
    const text = clampText(cleanImportPlainText(body));
    const chapters = splitTextIntoChapters(text, titleFromUrl(url));
    return chaptersToDocument(chapters, titleFromUrl(url));
  }

  const { text, title } = htmlToReadable(body, url);
  const cleaned = clampText(cleanImportPlainText(text));
  if (countWords(cleaned) < MIN_IMPORT_WORDS) {
    // Paywall / cookie walls often leave almost no article text.
    const lower = body.toLowerCase();
    if (
      /subscribe|paywall|premium content|sign in to continue|create an account to read/i.test(lower) &&
      countWords(cleaned) < MIN_IMPORT_WORDS
    ) {
      throw new Error(
        'Could not extract readable article text — the page looks paywalled or login-gated.',
      );
    }
  }

  const chapters = splitTextIntoChapters(cleaned, title || titleFromUrl(url));
  return chaptersToDocument(chapters, title || titleFromUrl(url));
}

async function ocrPdfPages(buffer: Buffer, pageCount: number): Promise<string> {
  const pagesToOcr = Math.min(pageCount || OCR_MAX_PAGES, OCR_MAX_PAGES);
  const parser = new PDFParse({ data: buffer });
  try {
    const shots = await parser.getScreenshot({
      first: pagesToOcr,
      scale: 1.5,
      imageBuffer: true,
      imageDataUrl: false,
    });

    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng');
    try {
      const parts: string[] = [];
      for (const page of shots.pages) {
        const data = page.data;
        if (!data?.length) continue;
        const result = await worker.recognize(Buffer.from(data));
        const text = cleanPdfPageText(result.data.text || '');
        if (text) parts.push(text);
      }
      return parts.join('\n\n');
    } finally {
      await worker.terminate().catch(() => undefined);
    }
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

function isPasswordError(err: unknown): boolean {
  if (err instanceof PasswordException) return true;
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
  const message = err instanceof Error ? err.message : String(err);
  return name === 'PasswordException' || /password/i.test(message);
}

export async function extractTextFromPdf(buffer: Buffer): Promise<ExtractedDocument> {
  let result: Awaited<ReturnType<PDFParse['getText']>>;
  let pageCount = 0;
  const parser = new PDFParse({ data: buffer });
  try {
    try {
      result = await parser.getText({ pageJoiner: '' });
      pageCount = result.total || result.pages?.length || 0;
    } catch (err) {
      if (isPasswordError(err)) {
        throw new Error('This PDF is password-protected. Remove the password and try again.');
      }
      throw err;
    }
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  const rawPages = (result.pages ?? []).map((p) => p.text || '');
  const cleanedPages = stripRepeatedPdfHeadersFooters(rawPages);
  const pageChapters: ExtractedChapter[] = cleanedPages
    .map((pageText, i) => ({
      title: `Page ${(result.pages?.[i]?.num ?? i + 1)}`,
      text: pageText,
    }))
    .filter((c) => c.text.length > 0);

  let text = clampText(cleanImportPlainText(pageChapters.map((c) => c.text).join('\n\n')));
  let usedOcr = false;
  const words = countWords(text);
  const wordsPerPage = pageCount > 0 ? words / pageCount : words;

  if (words < MIN_IMPORT_WORDS || (pageCount > 0 && wordsPerPage < OCR_WORDS_PER_PAGE_THRESHOLD)) {
    if (pageCount > OCR_MAX_PAGES && words < MIN_IMPORT_WORDS) {
      // Attempt OCR on first pages; if still thin, give a clear large-scan message.
      try {
        const ocrText = await ocrPdfPages(buffer, pageCount);
        const ocrWords = countWords(ocrText);
        if (ocrWords >= MIN_IMPORT_WORDS) {
          usedOcr = true;
          text = clampText(ocrText);
          const ocrPages = stripRepeatedPdfHeadersFooters(
            ocrText.split(/\n\n+/).filter((t) => t.trim()),
          );
          const chapters = ocrPages
            .map((t, i) => ({ title: `OCR page ${i + 1}`, text: t }))
            .filter((c) => c.text);
          return chaptersToDocument(
            chapters.length ? chapters : [{ title: 'OCR text', text }],
            undefined,
            { usedOcr: true, pageCount },
          );
        }
      } catch {
        // fall through to message
      }
      throw new Error(
        `This looks like a large scanned PDF (${pageCount} pages) with little extractable text. OCR is limited to the first ${OCR_MAX_PAGES} pages — try a text PDF, a shorter scan, or paste the text.`,
      );
    }

    try {
      const ocrText = await ocrPdfPages(buffer, pageCount || OCR_MAX_PAGES);
      const ocrWords = countWords(ocrText);
      if (ocrWords > words) {
        usedOcr = true;
        text = clampText(cleanImportPlainText(ocrText));
        const chapters = splitTextIntoChapters(text, 'Scanned PDF');
        return chaptersToDocument(chapters, undefined, { usedOcr: true, pageCount });
      }
    } catch (err) {
      if (words < MIN_IMPORT_WORDS) {
        throw new Error(
          err instanceof Error
            ? `Scanned PDF OCR failed: ${err.message}`
            : 'Scanned PDF OCR failed',
        );
      }
    }

    if (words < MIN_IMPORT_WORDS) {
      throw new Error(
        `No extractable text from PDF (scanned image PDFs need OCR). Tried OCR on up to ${OCR_MAX_PAGES} pages.`,
      );
    }
  }

  // Prefer page-based chapters for multi-page docs; collapse tiny pages into one stream.
  const chapters =
    pageChapters.length > 1 && pageChapters.some((c) => countWords(c.text) >= 20)
      ? pageChapters
      : splitTextIntoChapters(text, 'Imported PDF');

  return chaptersToDocument(chapters, undefined, { usedOcr, pageCount });
}

async function readEpubSpineOrder(zip: JSZip): Promise<string[] | null> {
  try {
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    if (!containerXml) return null;
    const $container = cheerio.load(containerXml, { xml: true });
    const opfPath = $container('rootfile').attr('full-path');
    if (!opfPath) return null;
    const opfXml = await zip.file(opfPath)?.async('string');
    if (!opfXml) return null;

    const $opf = cheerio.load(opfXml, { xml: true });
    const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const idToHref = new Map<string, string>();
    $opf('manifest > item').each((_, el) => {
      const id = $opf(el).attr('id');
      const href = $opf(el).attr('href');
      if (id && href) idToHref.set(id, baseDir + href);
    });
    const order: string[] = [];
    $opf('spine > itemref').each((_, el) => {
      const idref = $opf(el).attr('idref');
      if (!idref) return;
      const href = idToHref.get(idref);
      if (href) order.push(href.replace(/\\/g, '/'));
    });
    return order.length ? order : null;
  } catch {
    return null;
  }
}

function chapterTitleFromHtml(html: string, fallback: string): string {
  const $ = cheerio.load(html);
  const t =
    $('h1').first().text().trim() ||
    $('h2').first().text().trim() ||
    $('title').first().text().trim() ||
    fallback;
  return t.replace(/\s+/g, ' ').slice(0, 120) || fallback;
}

export async function extractTextFromEpub(buffer: Buffer): Promise<ExtractedDocument> {
  const zip = await JSZip.loadAsync(buffer);
  const spine = await readEpubSpineOrder(zip);
  const htmlNames =
    spine?.filter((n) => /\.(xhtml|html|htm)$/i.test(n) && zip.files[n] && !zip.files[n].dir) ??
    Object.keys(zip.files)
      .filter((n) => /\.(xhtml|html|htm)$/i.test(n) && !zip.files[n].dir)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  if (htmlNames.length === 0) {
    throw new Error('No readable HTML content found in EPUB');
  }

  const chapters: ExtractedChapter[] = [];
  for (let i = 0; i < htmlNames.length; i++) {
    const name = htmlNames[i];
    const file = zip.files[name];
    if (!file) continue;
    const html = await file.async('string');
    const text = htmlToCleanText(html);
    if (!text || countWords(text) < 3) continue;
    const fallback = `Chapter ${chapters.length + 1}`;
    chapters.push({
      title: chapterTitleFromHtml(html, fallback),
      text,
    });
  }

  if (chapters.length === 0) {
    throw new Error('No extractable text found in EPUB');
  }

  return chaptersToDocument(chapters);
}

export function formatFileSizeLimit(): string {
  return `${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB`;
}
