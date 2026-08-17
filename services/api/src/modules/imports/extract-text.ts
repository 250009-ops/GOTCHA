import { PDFParse, PasswordException } from 'pdf-parse';
import JSZip from 'jszip';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { safeFetch } from '../../common/safe-fetch';
import {
  cleanImportPlainText,
  cleanPdfPageText,
  htmlToCleanText,
  normalizeImportWhitespace,
  stripRepeatedPdfHeadersFooters,
} from './import-text-cleaner';
import {
  chaptersHaveRealTitles,
  splitAccurateChapters,
  splitByOutlineTitles,
} from './chapter-split';
import {
  gutenbergHtmlBookUrls,
  gutenbergPlainTextUrls,
  looksLikeGutenbergLandingPage,
  parseGutenbergId,
} from './gutenberg';

export const MIN_IMPORT_WORDS = 50;
/** Paste / extracted text hard cap — long novels and multi-volume books. */
export const MAX_IMPORT_CHARS = 20_000_000;
/** Soft cap for a single extracted document before chapter packing. */
export const MAX_EXTRACTED_CHARS = 20_000_000;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;
/** Hard page ceiling for PDF text extract (OCR stays separately capped). */
export const MAX_PDF_PAGES = 4000;
/** Browser-like UA; Wikimedia requires a descriptive UA with contact. */
const IMPORT_USER_AGENT =
  'GotchaImporter/2.1 (+https://gotcha.app; contact=imports@gotcha.app) Mozilla/5.0 (compatible; AppleWebKit/537.36; Chrome/122.0.0.0 Safari/537.36)';
/** OCR is expensive; keep a tight cap even when text-layer PDFs may be huge. */
export const OCR_MAX_PAGES = 200;
const URL_FETCH_TIMEOUT_MS = 180_000;
const URL_MAX_BYTES = 40 * 1024 * 1024;
/** Gutenberg mirrors: fail fast instead of waiting 3 minutes per 404/hang. */
const GUTENBERG_FETCH_TIMEOUT_MS = 15_000;
/** Cheerio/JSDOM on illustrated HTML can OOM the API process (502s, stuck imports). */
const HTML_PARSE_MAX_CHARS = 2_500_000;
const GUTENBERG_TXT_MAX_BYTES = 8 * 1024 * 1024;
const GUTENBERG_HTML_MAX_BYTES = 6 * 1024 * 1024;
/** Generic web pages — do not buffer tens of MB into cheerio. */
const GENERIC_HTML_MAX_BYTES = 8 * 1024 * 1024;
/** OCR pages in batches to bound peak memory (screenshots + tesseract). */
export const OCR_BATCH_SIZE = 15;
/** Render scale for OCR (~144 DPI at 2.0 × 72). Higher = better Latin accuracy, more RAM. */
export const OCR_RENDER_SCALE = 2;
/** Per-page: OCR when the text layer has fewer than this many words. */
export const OCR_PAGE_MIN_WORDS = 15;
/** Document-level: also consider OCR when average words/page is below this. */
export const OCR_WORDS_PER_PAGE_THRESHOLD = 15;
/** Group consecutive PDF pages into reader chapters for large docs. */
export const PDF_CHAPTER_PAGE_GROUP = 10;

export interface ExtractedChapter {
  title: string;
  text: string;
}

export interface ImportProgress {
  pagesDone: number;
  pagesTotal: number;
}

export interface ExtractPdfOptions {
  onProgress?: (progress: ImportProgress) => void | Promise<void>;
  /** App language hint — English gets best OCR; RU uses rus; UZ falls back to eng. */
  language?: string | null;
}

export interface ExtractedDocument {
  text: string;
  chapters: ExtractedChapter[];
  detectedTitle?: string;
  usedOcr?: boolean;
  pageCount?: number;
  truncatedPages?: boolean;
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
 * Split long paste / plain text into chapters using explicit headings only.
 * Falls back to a single chapter when no structure is found (paginateText handles pages).
 */
export function splitTextIntoChapters(text: string, fallbackTitle = 'Imported text'): ExtractedChapter[] {
  const normalized = normalizeWhitespace(text);
  if (!normalized) return [];
  return splitAccurateChapters(normalized, fallbackTitle);
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

/** Content-root selectors (not body) — Weebly/Wix-style sites often split articles across sections. */
const MAIN_CONTENT_SELECTORS = [
  '#wsite-content',
  '#main-wrap',
  'article',
  'main',
  '[role="main"]',
  '.mw-parser-output',
  '.post-content',
  '.entry-content',
  '.article-body',
  '.article-content',
  '#content',
  '#mw-content-text',
  '.content-area',
  '.page-content',
];

type CheerioAPI = ReturnType<typeof cheerio.load>;

function pageTitleFromHtml($: CheerioAPI): string | undefined {
  return (
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().replace(/\s+/g, ' ').trim() ||
    undefined
  );
}

/** True when `longer` substantially continues the same article as `shorter` (Readability truncated). */
function looksLikeExtendedArticle(shorter: string, longer: string): boolean {
  const shortWords = countWords(shorter);
  const longWords = countWords(longer);
  if (shortWords < MIN_IMPORT_WORDS || longWords < shortWords * 1.2) return false;

  const normalize = (t: string) =>
    t
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const a = normalize(shorter);
  const b = normalize(longer);
  if (!a || !b || b.length < a.length) return false;

  // Prefer a mid-article fingerprint so shared nav chrome at the start does not fake a match.
  const probeLen = Math.min(180, Math.floor(a.length * 0.35));
  const probeStart = Math.min(Math.floor(a.length * 0.25), Math.max(0, a.length - probeLen));
  const probe = a.slice(probeStart, probeStart + probeLen).trim();
  if (probe.length < 40) return b.includes(a.slice(0, Math.min(120, a.length)));
  return b.includes(probe);
}

function extractFromContentRoots(
  html: string,
): { text: string; title?: string; words: number } | null {
  const $ = cheerio.load(html);
  const title = pageTitleFromHtml($);
  let best: { text: string; words: number } | null = null;

  for (const sel of MAIN_CONTENT_SELECTORS) {
    const node = $(sel).first();
    if (!node.length) continue;
    const fragment = node.html();
    if (!fragment) continue;
    const text = htmlToCleanText(fragment);
    const words = countWords(text);
    if (words < MIN_IMPORT_WORDS) continue;
    if (!best || words > best.words) best = { text, words };
  }

  if (!best) return null;
  return { text: best.text, title, words: best.words };
}

function looksLikeLongFormBook(html: string, url: string): boolean {
  if (parseGutenbergId(url)) return true;
  if (html.length > 400_000) return true;
  const headingHits = html.match(/<(h1|h2|h3)\b/gi)?.length ?? 0;
  const chapterHits = html.match(/\bchapter\s+\d+/gi)?.length ?? 0;
  return headingHits >= 20 || chapterHits >= 8;
}

function boundHtmlForParse(html: string): string {
  if (html.length <= HTML_PARSE_MAX_CHARS) return html;
  return html.slice(0, HTML_PARSE_MAX_CHARS);
}

function htmlToReadable(html: string, url: string): { text: string; title?: string } {
  const bounded = boundHtmlForParse(html);
  let readability: { text: string; title?: string; words: number } | null = null;
  const preferFullBook = looksLikeLongFormBook(bounded, url);
  try {
    if (!preferFullBook) {
      const dom = new JSDOM(bounded, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();
      // Prefer Readability's HTML fragment so tables/images can be converted properly.
      if (article?.content && countWords(article.textContent || '') >= MIN_IMPORT_WORDS) {
        const text = htmlToCleanText(article.content);
        const words = countWords(text);
        if (words >= MIN_IMPORT_WORDS) {
          readability = {
            text,
            title: article.title?.trim() || undefined,
            words,
          };
        }
      }
    }
  } catch {
    // fall through to cheerio path
  }

  const fromRoot = extractFromContentRoots(bounded);

  // Readability often stops early on multi-section builders (Weebly parallax breaks, etc.).
  // Prefer a known content root when it clearly continues the same article further.
  if (
    readability &&
    fromRoot &&
    fromRoot.words > readability.words * 1.2 &&
    looksLikeExtendedArticle(readability.text, fromRoot.text)
  ) {
    return {
      text: fromRoot.text,
      title: readability.title || fromRoot.title,
    };
  }

  if (readability) {
    return { text: readability.text, title: readability.title };
  }

  const $ = cheerio.load(bounded);
  const title = pageTitleFromHtml($);
  const mainHtml = $('body').html() || bounded;
  const fromBody = htmlToCleanText(mainHtml);
  const bodyWords = countWords(fromBody);

  if (fromRoot && (!preferFullBook || fromRoot.words >= bodyWords * 0.85)) {
    return { text: fromRoot.text, title: fromRoot.title || title };
  }

  if (bodyWords >= MIN_IMPORT_WORDS) {
    return { text: fromBody, title: fromRoot?.title || title };
  }

  if (fromRoot) {
    return { text: fromRoot.text, title: fromRoot.title };
  }

  return { text: fromBody, title };
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

function fetchHeaders(accept: string): Record<string, string> {
  return {
    'User-Agent': IMPORT_USER_AGENT,
    Accept: accept,
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  };
}

/** Normalize mobile / http Wikipedia URLs and extract API origin + article title. */
export function parseWikipediaUrl(
  url: string,
): { apiOrigin: string; title: string; canonicalUrl: string } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }

  const host = u.hostname.replace(/^www\./i, '').toLowerCase();
  const mobile = host.match(/^([a-z0-9-]+)\.m\.wikipedia\.org$/i);
  const desktop = host.match(/^([a-z0-9-]+)\.wikipedia\.org$/i);
  const lang = (mobile?.[1] || desktop?.[1] || '').toLowerCase();
  if (!lang || lang === 'm') return null;

  let title = '';
  if (u.pathname.startsWith('/wiki/')) {
    title = decodeURIComponent(u.pathname.slice('/wiki/'.length));
  } else if (/\/w\/index\.php$/i.test(u.pathname)) {
    title = u.searchParams.get('title') || '';
  }
  title = title.replace(/_/g, ' ').trim();
  if (!title || /^Special:/i.test(title) || /^File:/i.test(title)) return null;

  const apiOrigin = `https://${lang}.wikipedia.org`;
  const canonicalUrl = `${apiOrigin}/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%3A/gi, ':')}`;
  return { apiOrigin, title, canonicalUrl };
}

async function extractWikipediaViaApi(
  parsed: { apiOrigin: string; title: string; canonicalUrl: string },
): Promise<ExtractedDocument | null> {
  const apiUrl =
    `${parsed.apiOrigin}/w/api.php?` +
    new URLSearchParams({
      action: 'parse',
      page: parsed.title,
      prop: 'text|displaytitle',
      formatversion: '2',
      format: 'json',
      redirects: '1',
      disableeditsection: '1',
      disabletoc: '1',
    }).toString();

  let response: Response;
  try {
    response = await safeFetch(apiUrl, {
      headers: fetchHeaders('application/json'),
      signal: AbortSignal.timeout(URL_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!response.ok) return null;

  let payload: {
    error?: { code?: string; info?: string };
    parse?: { title?: string; displaytitle?: string; text?: string };
  };
  try {
    payload = (await response.json()) as typeof payload;
  } catch {
    return null;
  }

  if (payload.error || !payload.parse?.text) {
    return null;
  }

  const html = typeof payload.parse.text === 'string' ? payload.parse.text : '';
  const displayTitle = (payload.parse.displaytitle || payload.parse.title || parsed.title)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safeTitle = displayTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Wrap fragment so cheerio / Readability see a full document.
  const wrapped = `<!DOCTYPE html><html><head><title>${safeTitle}</title></head><body><div class="mw-parser-output">${html}</div></body></html>`;
  const { text, title } = htmlToReadable(wrapped, parsed.canonicalUrl);
  const cleaned = clampText(cleanImportPlainText(text));
  if (countWords(cleaned) < MIN_IMPORT_WORDS) {
    // Fallback: strip tags from the parse HTML directly.
    const direct = clampText(cleanImportPlainText(htmlToCleanText(html)));
    if (countWords(direct) < MIN_IMPORT_WORDS) return null;
    const chapters = splitTextIntoChapters(direct, displayTitle);
    return chaptersToDocument(chapters, displayTitle);
  }

  const chapters = splitTextIntoChapters(cleaned, title || displayTitle);
  return chaptersToDocument(chapters, title || displayTitle);
}

function decodeFetchedText(buf: Buffer, charsetHint: string): string {
  const hint = charsetHint.toLowerCase().replace(/['"]/g, '');
  if (
    hint.includes('iso-8859') ||
    hint.includes('latin') ||
    hint.includes('windows-1252') ||
    hint.includes('cp1252')
  ) {
    return buf.toString('latin1');
  }
  const utf8 = buf.toString('utf8');
  const bad = (utf8.match(/\uFFFD/g) ?? []).length;
  if (bad > 40 && bad / Math.max(utf8.length, 1) > 0.002) {
    return buf.toString('latin1');
  }
  return utf8;
}

type ReadUrlOptions = {
  timeoutMs?: number;
  maxBytes?: number;
};

function tooLargeMessage(bytes: number, maxBytes: number): Error {
  return new Error(
    `This page is too large to import (${Math.round(bytes / (1024 * 1024))} MB). Maximum is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
  );
}

async function readResponseBounded(response: Response, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > maxBytes) throw tooLargeMessage(declared, maxBytes);

  const stream = response.body;
  if (!stream) {
    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.length > maxBytes) throw tooLargeMessage(buf.length, maxBytes);
    return buf;
  }

  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.length) continue;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw tooLargeMessage(size, maxBytes);
      }
      chunks.push(value);
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // already cancelled
    }
  }
  return Buffer.concat(chunks, size);
}

async function readUrlBody(
  url: string,
  accept: string,
  options: ReadUrlOptions = {},
): Promise<{ body: string; contentType: string; finalUrl: string }> {
  const timeoutMs = options.timeoutMs ?? URL_FETCH_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? URL_MAX_BYTES;
  let response: Response;
  try {
    response = await safeFetch(url, {
      headers: fetchHeaders(accept),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    throw mapFetchError(err);
  }
  if (!response.ok) {
    throw mapFetchError(undefined, response.status);
  }
  const buf = await readResponseBounded(response, maxBytes);
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  const charset = contentType.match(/charset=([^\s;]+)/i)?.[1] ?? '';
  return {
    body: decodeFetchedText(buf, charset),
    contentType,
    finalUrl: response.url || url,
  };
}

async function extractGutenbergPlainText(id: string): Promise<ExtractedDocument | null> {
  const tryOne = async (txtUrl: string) => {
    const { body } = await readUrlBody(txtUrl, 'text/plain,*/*;q=0.8', {
      timeoutMs: GUTENBERG_FETCH_TIMEOUT_MS,
      maxBytes: GUTENBERG_TXT_MAX_BYTES,
    });
    const text = clampText(cleanImportPlainText(body));
    if (countWords(text) < MIN_IMPORT_WORDS) throw new Error('too short');
    const chapters = splitAccurateChapters(text, titleFromUrl(txtUrl));
    return chaptersToDocument(chapters, titleFromUrl(txtUrl));
  };

  const urls = gutenbergPlainTextUrls(id);
  try {
    return await Promise.any(urls.slice(0, 3).map((txtUrl) => tryOne(txtUrl)));
  } catch {
    for (const txtUrl of urls.slice(3)) {
      try {
        return await tryOne(txtUrl);
      } catch {
        // Try the next Gutenberg text mirror.
      }
    }
    return null;
  }
}

async function extractGutenbergHtmlBook(id: string): Promise<ExtractedDocument | null> {
  for (const htmlUrl of gutenbergHtmlBookUrls(id)) {
    try {
      const { body, finalUrl } = await readUrlBody(
        htmlUrl,
        'text/html,application/xhtml+xml,*/*;q=0.8',
        {
          timeoutMs: GUTENBERG_FETCH_TIMEOUT_MS,
          maxBytes: GUTENBERG_HTML_MAX_BYTES,
        },
      );
      if (looksLikeGutenbergLandingPage(body, countWords(htmlToCleanText(boundHtmlForParse(body))))) {
        continue;
      }
      const { text, title } = htmlToReadable(body, finalUrl);
      const cleaned = clampText(cleanImportPlainText(text));
      if (countWords(cleaned) < 2_000) continue;
      const chapters = splitAccurateChapters(cleaned, title || titleFromUrl(htmlUrl));
      return chaptersToDocument(chapters, title || titleFromUrl(htmlUrl));
    } catch {
      // Try the next compact HTML book mirror.
    }
  }
  return null;
}

export async function extractTextFromUrl(url: string): Promise<ExtractedDocument> {
  const gutenbergId = parseGutenbergId(url);
  if (gutenbergId) {
    const fromTxt = await extractGutenbergPlainText(gutenbergId);
    if (fromTxt && countWords(fromTxt.text) >= MIN_IMPORT_WORDS) {
      return fromTxt;
    }
    const fromHtml = await extractGutenbergHtmlBook(gutenbergId);
    if (fromHtml && countWords(fromHtml.text) >= MIN_IMPORT_WORDS) {
      return fromHtml;
    }
    throw new Error(
      'Could not download the full Project Gutenberg book. Use the Plain Text UTF-8 file URL, or paste the text.',
    );
  }

  const wiki = parseWikipediaUrl(url);
  if (wiki) {
    const fromApi = await extractWikipediaViaApi(wiki);
    if (fromApi && countWords(fromApi.text) >= MIN_IMPORT_WORDS) {
      return fromApi;
    }
    // Fall through to HTML fetch using the canonical desktop URL.
    url = wiki.canonicalUrl;
  }

  const { body, contentType, finalUrl } = await readUrlBody(
    url,
    'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8',
    { maxBytes: GENERIC_HTML_MAX_BYTES },
  );

  if (contentType.includes('text/plain') || /\.txt(\?|$)/i.test(url)) {
    const text = clampText(cleanImportPlainText(body));
    const chapters = splitTextIntoChapters(text, titleFromUrl(url));
    return chaptersToDocument(chapters, titleFromUrl(url));
  }

  // If HTML fetch redirected onto Wikipedia, try the API once more with the final URL.
  const wikiFinal = parseWikipediaUrl(finalUrl);
  if (wikiFinal && !wiki) {
    const fromApi = await extractWikipediaViaApi(wikiFinal);
    if (fromApi && countWords(fromApi.text) >= MIN_IMPORT_WORDS) {
      return fromApi;
    }
  }

  const { text, title } = htmlToReadable(body, finalUrl);
  const cleaned = clampText(cleanImportPlainText(text));
  if (countWords(cleaned) < MIN_IMPORT_WORDS) {
    // Paywall / cookie walls often leave almost no article text.
    const lower = body.toLowerCase();
    if (
      /subscribe to (continue|read)|paywall|premium content|sign in to continue|create an account to read/i.test(
        lower,
      ) &&
      countWords(cleaned) < MIN_IMPORT_WORDS
    ) {
      throw new Error(
        'Could not extract readable article text — the page looks paywalled or login-gated.',
      );
    }
    throw new Error(
      `Need at least ${MIN_IMPORT_WORDS} words (found ${countWords(cleaned)}). The page may block extraction — try paste instead.`,
    );
  }

  const chapters = splitTextIntoChapters(cleaned, title || titleFromUrl(finalUrl));
  return chaptersToDocument(chapters, title || titleFromUrl(finalUrl));
}

function isPasswordError(err: unknown): boolean {
  if (err instanceof PasswordException) return true;
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : '';
  const message = err instanceof Error ? err.message : String(err);
  return name === 'PasswordException' || /password/i.test(message);
}

/** Map app language to a tesseract traineddata code. Uzbek has no solid pack — use eng. */
function tesseractLangFor(language?: string | null): { lang: string; note?: string } {
  const code = (language || 'en').toLowerCase();
  if (code === 'ru' || code === 'rus') {
    return {
      lang: 'rus+eng',
      note: 'Russian OCR uses rus+eng; accuracy is lower than English text PDFs.',
    };
  }
  if (code === 'uz' || code === 'uzb') {
    return {
      lang: 'eng',
      note: 'Uzbek OCR is not well supported; English OCR is used and accuracy may be poor for Cyrillic/Latin UZ text.',
    };
  }
  const tess: Record<string, string> = {
    fr: 'fra+eng',
    es: 'spa+eng',
    de: 'deu+eng',
    pt: 'por+eng',
    ja: 'jpn+eng',
    ko: 'kor+eng',
  };
  if (tess[code]) return { lang: tess[code] };
  return { lang: 'eng' };
}

async function reportProgress(
  onProgress: ExtractPdfOptions['onProgress'],
  pagesDone: number,
  pagesTotal: number,
): Promise<void> {
  if (!onProgress) return;
  try {
    await onProgress({ pagesDone, pagesTotal });
  } catch {
    // Progress updates must never fail the import.
  }
}

/**
 * OCR specific 1-based page numbers in batches. Prefer calling only for pages
 * whose text layer is thin/empty. Keeps peak memory bounded via OCR_BATCH_SIZE.
 */
async function ocrPdfPageNumbers(
  buffer: Buffer,
  pageNumbers: number[],
  options?: {
    language?: string | null;
    onBatchDone?: (completedInBatch: number) => void | Promise<void>;
  },
): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (pageNumbers.length === 0) return out;

  const { lang } = tesseractLangFor(options?.language);
  const { createWorker } = await import('tesseract.js');
  // OEM 1 = LSTM only — better accuracy for modern Latin print than legacy engine.
  const worker = await createWorker(lang, 1);
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: '3' as never, // fully automatic page segmentation
      user_defined_dpi: '144',
    });

    for (let i = 0; i < pageNumbers.length; i += OCR_BATCH_SIZE) {
      const batch = pageNumbers.slice(i, i + OCR_BATCH_SIZE);
      const parser = new PDFParse({ data: buffer });
      try {
        const shots = await parser.getScreenshot({
          partial: batch,
          scale: OCR_RENDER_SCALE,
          imageBuffer: true,
          imageDataUrl: false,
        });

        for (const page of shots.pages) {
          const data = page.data;
          const pageNum = page.pageNumber;
          if (!data?.length || !pageNum) continue;
          const result = await worker.recognize(Buffer.from(data));
          const text = cleanPdfPageText(result.data.text || '');
          if (text) out.set(pageNum, text);
        }
      } finally {
        await parser.destroy().catch(() => undefined);
      }

      if (options?.onBatchDone) {
        await options.onBatchDone(batch.length);
      }
    }
  } finally {
    await worker.terminate().catch(() => undefined);
  }

  return out;
}

function flattenPdfOutline(nodes: unknown, depth = 0): string[] {
  if (!Array.isArray(nodes) || depth > 4) return [];
  const out: string[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    const item = node as { title?: string; items?: unknown };
    const title = String(item.title || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (title && !/^(cover|title page|copyright|contents|table of contents)$/i.test(title) && depth <= 2) {
      out.push(title);
    }
    if (item.items) out.push(...flattenPdfOutline(item.items, depth + 1));
  }
  return out;
}

/** Build chapter list from ordered page texts (outline, headings, then page groups). */
function chaptersFromPdfPages(
  pageTexts: string[],
  fallbackTitle = 'Imported PDF',
  outlineTitles: string[] = [],
): ExtractedChapter[] {
  const nonEmpty = pageTexts
    .map((t, i) => ({ page: i + 1, text: t.trim() }))
    .filter((p) => p.text.length > 0);

  if (nonEmpty.length === 0) {
    return [];
  }

  const joined = nonEmpty.map((p) => p.text).join('\n\n');
  const headed = splitAccurateChapters(joined, fallbackTitle);
  const fromOutline =
    outlineTitles.length >= 2 ? splitByOutlineTitles(joined, outlineTitles, fallbackTitle) : null;

  if (fromOutline && chaptersHaveRealTitles(fromOutline)) {
    if (!chaptersHaveRealTitles(headed) || fromOutline.length > headed.length) {
      return fromOutline;
    }
  }
  if (headed.length > 1 && (chaptersHaveRealTitles(headed) || headed.some((c) => countWords(c.text) >= 40))) {
    return headed;
  }
  if (fromOutline && fromOutline.length > 1) return fromOutline;

  if (nonEmpty.length === 1) {
    return headed.length ? headed : [{ title: fallbackTitle, text: nonEmpty[0].text }];
  }

  // Last resort: group consecutive pages so huge scans still get a usable TOC.
  const chapters: ExtractedChapter[] = [];
  for (let i = 0; i < nonEmpty.length; i += PDF_CHAPTER_PAGE_GROUP) {
    const slice = nonEmpty.slice(i, i + PDF_CHAPTER_PAGE_GROUP);
    const start = slice[0].page;
    const end = slice[slice.length - 1].page;
    const title = start === end ? `Page ${start}` : `Pages ${start}–${end}`;
    chapters.push({
      title,
      text: slice.map((p) => p.text).join('\n\n'),
    });
  }
  return chapters;
}

export async function extractTextFromPdf(
  buffer: Buffer,
  options: ExtractPdfOptions = {},
): Promise<ExtractedDocument> {
  let result: Awaited<ReturnType<PDFParse['getText']>>;
  let fullPageCount = 0;
  let outlineTitles: string[] = [];
  let detectedTitle: string | undefined;
  const parser = new PDFParse({ data: buffer });
  try {
    try {
      try {
        const info = await parser.getInfo();
        outlineTitles = flattenPdfOutline(info.outline);
        const metaTitle = String((info.info as { Title?: string } | undefined)?.Title || '').trim();
        if (metaTitle && metaTitle.length <= 160) detectedTitle = metaTitle;
      } catch {
        // Outline is optional — heading detection still runs.
      }
      // Cap pages at MAX_PDF_PAGES during text extract when the API supports first/last.
      result = await parser.getText({
        pageJoiner: '',
        first: 1,
        last: MAX_PDF_PAGES,
      });
      fullPageCount = result.total || result.pages?.length || 0;
    } catch (err) {
      if (isPasswordError(err)) {
        throw new Error('This PDF is password-protected. Remove the password and try again.');
      }
      throw err;
    }
  } finally {
    await parser.destroy().catch(() => undefined);
  }

  // If getText ignored first/last, still slice in memory.
  const allPages = result.pages ?? [];
  const truncatedPages = allPages.length > MAX_PDF_PAGES || fullPageCount > MAX_PDF_PAGES;
  const pages = allPages.slice(0, MAX_PDF_PAGES);
  const pageCount = pages.length;
  const pagesTotal = pageCount;

  await reportProgress(options.onProgress, 0, pagesTotal || 1);

  const rawPages = pages.map((p) => p.text || '');
  const cleanedPages = stripRepeatedPdfHeadersFooters(rawPages);

  // Per-page text layer first; decide OCR only where thin.
  const pageTexts = cleanedPages.map((t) => cleanPdfPageText(t));
  const pageWordCounts = pageTexts.map((t) => countWords(t));
  const totalTextWords = pageWordCounts.reduce((a, b) => a + b, 0);
  const wordsPerPage = pageCount > 0 ? totalTextWords / pageCount : totalTextWords;

  const needsOcrScan =
    totalTextWords < MIN_IMPORT_WORDS ||
    (pageCount > 0 && wordsPerPage < OCR_WORDS_PER_PAGE_THRESHOLD);

  const pagesNeedingOcr: number[] = [];
  for (let i = 0; i < pageCount; i++) {
    if (pageWordCounts[i] < OCR_PAGE_MIN_WORDS) {
      pagesNeedingOcr.push(pages[i]?.num ?? i + 1);
    }
  }

  // Cap OCR work — scanned pages are expensive even when the text-layer book is huge.
  const ocrTargets = pagesNeedingOcr.slice(0, OCR_MAX_PAGES);
  const thinRatio = pageCount > 0 ? pagesNeedingOcr.length / pageCount : 0;
  // Text-heavy PDFs skip OCR (blank separators stay blank). Scanned / mixed docs OCR thin pages.
  const shouldRunOcr =
    ocrTargets.length > 0 &&
    (needsOcrScan || totalTextWords < MIN_IMPORT_WORDS || thinRatio >= 0.3);
  let usedOcr = false;

  if (shouldRunOcr) {
    let ocrDone = 0;
    // Count text-layer-only pages as already "done" for progress UX.
    const textOnlyDone = pageCount - ocrTargets.length;
    await reportProgress(options.onProgress, Math.max(0, textOnlyDone), pagesTotal);

    try {
      const ocrMap = await ocrPdfPageNumbers(buffer, ocrTargets, {
        language: options.language,
        onBatchDone: async (n) => {
          ocrDone += n;
          await reportProgress(
            options.onProgress,
            Math.min(pagesTotal, textOnlyDone + ocrDone),
            pagesTotal,
          );
        },
      });
      usedOcr = ocrMap.size > 0;

      for (let i = 0; i < pageCount; i++) {
        const pageNum = pages[i]?.num ?? i + 1;
        const ocrText = ocrMap.get(pageNum);
        if (!ocrText) continue;
        const existingWords = countWords(pageTexts[i] || '');
        const ocrWords = countWords(ocrText);
        if (ocrWords > existingWords) {
          pageTexts[i] = ocrText;
        }
      }
    } catch (err) {
      if (totalTextWords < MIN_IMPORT_WORDS) {
        throw new Error(
          err instanceof Error
            ? `Scanned PDF OCR failed: ${err.message}`
            : 'Scanned PDF OCR failed',
        );
      }
      // Keep text-layer content when OCR fails mid-document.
    }
  } else {
    await reportProgress(options.onProgress, pagesTotal, pagesTotal);
  }

  // Normalize header/footer again after OCR merges.
  const finalPages = stripRepeatedPdfHeadersFooters(pageTexts);
  const text = clampText(cleanImportPlainText(finalPages.join('\n\n')));
  const words = countWords(text);

  if (words < MIN_IMPORT_WORDS) {
    throw new Error(
      pageCount === 0
        ? 'No extractable text from PDF'
        : `No extractable text from PDF after text-layer extract and OCR on ${ocrTargets.length} page(s) (of ${pageCount}). Try a text PDF, higher-quality scan, or paste.`,
    );
  }

  await reportProgress(options.onProgress, pagesTotal, pagesTotal);

  const chapters = chaptersFromPdfPages(finalPages, detectedTitle || 'Imported PDF', outlineTitles);
  return chaptersToDocument(chapters.length ? chapters : [{ title: 'Imported PDF', text }], detectedTitle, {
    usedOcr,
    pageCount: fullPageCount || pageCount,
    truncatedPages,
  });
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
