import { Logger } from '@nestjs/common';
import { countWords, ExtractedChapter } from './extract-text';
import { cleanImportPlainText } from './import-text-cleaner';

export type ImportCleanupSource = 'url' | 'pdf' | 'epub';

const logger = new Logger('ImportAiCleanup');

/** Per OpenAI request character budget (keeps latency/cost bounded). */
export const IMPORT_AI_CHUNK_CHARS = 10_000;
/** Skip AI for tiny fragments (headers already handled deterministically). */
export const IMPORT_AI_MIN_CHAPTER_WORDS = 60;
/** Cap how much text we send through the model per import. */
export const IMPORT_AI_MAX_TOTAL_CHARS = 220_000;
/** If removal leaves far less than the original, treat as over-deletion. */
export const IMPORT_AI_MIN_RETAIN_RATIO = 0.22;
/**
 * If cleaned text loses the original ending fingerprint, treat as over-trim
 * (common when the model drops listening-test wrap-ups / last page body).
 */
export const IMPORT_AI_ENDING_PROBE_CHARS = 48;
/** Soft ceiling on model calls per import (chunks). */
export const IMPORT_AI_MAX_CHUNKS = 28;
/** Ignore short snippet suggestions (too easy to over-match). */
export const IMPORT_AI_MIN_SNIPPET_CHARS = 16;
/** Skip a snippet if it occurs too often in the chunk (likely generic). */
export const IMPORT_AI_MAX_SNIPPET_OCCURRENCES = 12;
/** Cap snippet suggestions applied per chunk. */
export const IMPORT_AI_MAX_SNIPPETS = 40;

/**
 * Phrases that look instructional but are part of listening/exam transcripts.
 * Local removal must never drop blocks/snippets matching these.
 */
export const LEARNING_CONTENT_WRAPUP_RE =
  /\b(end of (the )?section|that is the end|check your answers|now (listen|turn|look) and answer|you now have .{0,40}(minute|second)s? to check|questions? \d+\s*(to|–|-)\s*\d+)\b/i;

/** True when text is learner-facing exam/listening content, not site chrome. */
export function isProtectedLearningText(text: string): boolean {
  return LEARNING_CONTENT_WRAPUP_RE.test(text);
}

/**
 * OpenAI only identifies unnecessary parts. Local code removes them.
 * Blocks are 1-based indexes matching the [B#] labels in the user prompt.
 * When unsure, leave text alone — false negatives (keeping chrome) are better than
 * deleting transcript endings or other learner content.
 */
export const IMPORT_CLEANUP_SYSTEM_PROMPT = `You identify unnecessary parts in imported reading material for a language-learning app.
Return ONLY JSON:
{"removeBlocks":[1],"removeSnippets":[],"dropChapter":false,"title":""}

Rules:
- You do NOT rewrite, summarize, translate, paraphrase, or invent text.
- Only select parts that should be removed. Our code deletes your selections from the original extract.
- When unsure whether something is chrome or content, leave it (empty remove lists). Prefer keeping text over deleting.
- removeBlocks: 1-based [B#] block indexes that are pure chrome/junk ONLY (nav, menus, sidebars, ads, cookie/GDPR banners, share buttons, related/recommended links, comment widgets, newsletter CTAs, author bio footers that are not part of the work, site chrome, legal/cookie policy blurbs, bare page numbers, repeated running headers/footers, "this page intentionally left blank", publisher marketing, standalone TOC chrome).
- removeSnippets: exact substrings copied VERBATIM from the blocks when only part of a kept block is junk. Must match the source text exactly. Prefer removeBlocks when a whole block is junk. Use [] when unsure.
- Keep the main body: headings, paragraphs, lists, story dialogue (quoted speech, ‘…’ / "…" lines, "said/asked" attributions), quotes, transcripts, and exam/listening passages. Never rewrite, drop, or re-title spoken lines.
- Keep conversation layout exactly as printed: each spoken turn on its own line. Never join adjacent quoted lines into one paragraph.
- Exclude images, figures, photos, illustrations, word-search/crossword letter grids, OCR garbage from pictures, and [Image: …] placeholders. Those are not learner text. Keep nearby story and activity instructions.
- NEVER remove exam/listening/IELTS-style instructional lines that belong to the document — even if they sound like UI. Always KEEP examples such as: "That is the end of section four", "You now have half a minute to check your answers", "Now listen and answer questions five to ten", "Now turn to section…". These are learner content, not chrome.
- dropChapter=true ONLY when this entire chunk is pure site/publisher chrome with zero readable main content. Never drop a chunk because it contains section endings, answer-check timing, or other transcript wrap-up lines.
- title = short chapter/section title if obvious from the body, else "".
- When nothing should be removed, return {"removeBlocks":[],"removeSnippets":[],"dropChapter":false,"title":""}.`;

export function isImportAiCleanupEnabled(): boolean {
  const raw = process.env.IMPORT_AI_CLEANUP_ENABLED?.trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true;
  // Default on when explicitly unset — still no-ops without OPENAI_API_KEY.
  return true;
}

export function importCleanupModel(fallback = 'gpt-4.1-mini'): string {
  return (
    process.env.OPENAI_MODEL_IMPORT?.trim() ||
    process.env.OPENAI_MODEL_LOOKUP?.trim() ||
    fallback
  );
}

export function splitForImportAi(text: string, maxChars = IMPORT_AI_CHUNK_CHARS): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > 0) {
    if (remaining.length <= maxChars) {
      chunks.push(remaining.trim());
      break;
    }
    let cut = remaining.lastIndexOf('\n\n', maxChars);
    if (cut < maxChars * 0.4) cut = remaining.lastIndexOf('\n', maxChars);
    if (cut < maxChars * 0.4) cut = remaining.lastIndexOf(' ', maxChars);
    if (cut < maxChars * 0.4) cut = maxChars;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  return chunks.filter(Boolean);
}

/** Paragraph-style blocks used for AI selection labels [B1]…[Bn]. */
export function splitIntoCleanupBlocks(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .split(/\n\n+/)
    .map((b) => b.trim())
    .filter(Boolean);
}

export function formatBlocksForPrompt(blocks: string[]): string {
  return blocks.map((block, i) => `[B${i + 1}]\n${block}`).join('\n\n');
}

/** Collapse whitespace for ending / fingerprint compares. */
export function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * True when cleaned text still contains a fingerprint of the original ending.
 * Protects against AI dropping the last page / section wrap-up while retaining
 * enough earlier body that the retain-ratio check would still pass.
 */
export function originalEndingPreserved(original: string, cleaned: string): boolean {
  const o = normalizeForCompare(original);
  const c = normalizeForCompare(cleaned);
  if (o.length < IMPORT_AI_ENDING_PROBE_CHARS) return true;
  if (!c) return false;

  const probeLen = Math.min(IMPORT_AI_ENDING_PROBE_CHARS, Math.floor(o.length / 3));
  const probe = o.slice(-probeLen);
  if (c.includes(probe)) return true;

  // Allow mild OCR/cleanup whitespace drift: try a shorter interior probe.
  const short = probe.slice(Math.floor(probeLen * 0.2), Math.floor(probeLen * 0.8));
  if (short.length >= 16 && c.includes(short)) return true;

  // Last-resort: distinctive trailing words (length>=5) still appear near cleaned end.
  const oWords = o.split(' ').filter(Boolean);
  const cTail = c.slice(-Math.min(c.length, 320));
  const trail = oWords.slice(-16).filter((w) => w.length >= 5);
  if (trail.length < 3) return true;
  const hits = trail.filter((w) => cTail.includes(w)).length;
  return hits / trail.length >= 0.75;
}

export function shouldKeepCleanedText(original: string, cleaned: string): boolean {
  const cleanedText = cleanImportPlainText(cleaned);
  if (!cleanedText) return false;
  const origWords = countWords(original);
  const cleanedWords = countWords(cleanedText);
  if (cleanedWords < IMPORT_AI_MIN_CHAPTER_WORDS && origWords >= IMPORT_AI_MIN_CHAPTER_WORDS * 2) {
    return false;
  }
  if (origWords > 0 && cleanedWords / origWords < IMPORT_AI_MIN_RETAIN_RATIO) {
    return false;
  }
  if (!originalEndingPreserved(original, cleanedText)) {
    return false;
  }
  return true;
}

/** Structured selection returned by the model (no rewritten body). */
export type CleanupSelection = {
  removeBlocks: number[];
  removeSnippets: string[];
  dropChapter: boolean;
  title: string;
};

/** Locally cleaned chunk after applying a selection. */
export type CleanupChunkResult = {
  title?: string;
  text: string;
  dropChapter?: boolean;
};

function uniqueSortedInts(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const set = new Set<number>();
  for (const v of values) {
    const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
    if (!Number.isInteger(n) || n < 1) continue;
    set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

function normalizeSnippets(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const v of values) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (s.length < IMPORT_AI_MIN_SNIPPET_CHARS) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= IMPORT_AI_MAX_SNIPPETS) break;
  }
  return out;
}

export function parseCleanupSelection(raw: string | null | undefined): CleanupSelection | null {
  if (!raw?.trim()) return null;

  const tryParse = (json: string): CleanupSelection | null => {
    try {
      const parsed = JSON.parse(json) as {
        removeBlocks?: unknown;
        removeSnippets?: unknown;
        dropChapter?: unknown;
        title?: unknown;
        // Legacy rewrite schema — reject so callers fail-open instead of trusting model prose.
        text?: unknown;
      } | null;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      if (typeof parsed.text === 'string' && !('removeBlocks' in parsed)) {
        return null;
      }
      return {
        removeBlocks: uniqueSortedInts(parsed.removeBlocks),
        removeSnippets: normalizeSnippets(parsed.removeSnippets),
        dropChapter: parsed.dropChapter === true,
        title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
      };
    } catch {
      return null;
    }
  };

  const direct = tryParse(raw);
  if (direct) return direct;
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  return tryParse(match[0]);
}

function applySnippets(text: string, snippets: string[]): string {
  let out = text;
  // Longer first so nested/overlapping suggestions apply more stably.
  const ordered = [...snippets].sort((a, b) => b.length - a.length);
  for (const snip of ordered) {
    if (!out.includes(snip)) continue;
    const occurrences = out.split(snip).length - 1;
    if (occurrences <= 0 || occurrences > IMPORT_AI_MAX_SNIPPET_OCCURRENCES) continue;
    out = out.split(snip).join('');
  }
  return out;
}

/**
 * Apply AI selection to one original chunk. Never rewrites via the model —
 * only deletes selected blocks/snippets from the deterministic extract.
 * Fail-open: if the model is aggressive or targets protected learning wrap-ups,
 * keep the original chunk text rather than deleting learner content.
 */
export function applyCleanupSelection(
  chunkText: string,
  selection: CleanupSelection,
): CleanupChunkResult {
  const blocks = splitIntoCleanupBlocks(chunkText);

  // Never honor dropChapter on chunks that still look like real reading/listening material.
  if (selection.dropChapter) {
    const words = countWords(chunkText);
    if (words >= IMPORT_AI_MIN_CHAPTER_WORDS || isProtectedLearningText(chunkText)) {
      logger.debug(
        'Ignoring dropChapter — chunk looks like learner content (fail-open keep)',
      );
      return { title: selection.title, text: chunkText, dropChapter: false };
    }
    return { title: selection.title, text: '', dropChapter: true };
  }

  if (
    selection.removeBlocks.length === 0 &&
    selection.removeSnippets.length === 0
  ) {
    return { title: selection.title, text: chunkText, dropChapter: false };
  }

  const remove = new Set(
    selection.removeBlocks.filter((n) => {
      if (n < 1 || n > blocks.length) return false;
      // Never delete blocks that contain exam/listening wrap-up content.
      if (isProtectedLearningText(blocks[n - 1])) return false;
      return true;
    }),
  );

  const kept = blocks.filter((_, i) => !remove.has(i + 1));
  let next = kept.join('\n\n');
  if (selection.removeSnippets.length > 0) {
    const safeSnippets = selection.removeSnippets.filter(
      (s) => !isProtectedLearningText(s),
    );
    next = applySnippets(next, safeSnippets);
  }

  const cleaned = cleanImportPlainText(next);
  // Per-chunk fail-open: if removal wiped the chunk ending / most body / wrap-ups, keep original.
  if (!shouldKeepCleanedText(chunkText, cleaned)) {
    return { title: selection.title, text: chunkText, dropChapter: false };
  }
  if (isProtectedLearningText(chunkText) && !isProtectedLearningText(cleaned)) {
    return { title: selection.title, text: chunkText, dropChapter: false };
  }
  return { title: selection.title, text: cleaned, dropChapter: false };
}

/** Parse model JSON and apply removal locally. Null = invalid selection. */
export function processCleanupChunk(
  chunkText: string,
  rawModelJson: string | null | undefined,
): CleanupChunkResult | null {
  const selection = parseCleanupSelection(rawModelJson);
  if (!selection) return null;
  return applyCleanupSelection(chunkText, selection);
}

export function buildCleanupUserPrompt(opts: {
  source: ImportCleanupSource;
  documentTitle?: string;
  chapterTitle?: string;
  chunkIndex: number;
  chunkTotal: number;
  text: string;
}): string {
  const sourceHint =
    opts.source === 'url'
      ? 'Source: web page URL import. Prefer main article body; drop site chrome. Keep article endings.'
      : opts.source === 'pdf'
        ? 'Source: PDF file import. Prefer document body; drop only repeated running headers/footers and bare page numbers. Keep transcript/exam body and section wrap-ups.'
        : 'Source: EPUB file import. Prefer chapter body; drop publisher/front-matter chrome.';

  const isFinalChunk = opts.chunkTotal > 0 && opts.chunkIndex === opts.chunkTotal - 1;
  const blocks = splitIntoCleanupBlocks(opts.text);
  const labeled = formatBlocksForPrompt(blocks);

  return [
    sourceHint,
    opts.documentTitle ? `Document title: ${opts.documentTitle}` : null,
    opts.chapterTitle ? `Chapter title: ${opts.chapterTitle}` : null,
    `Chunk ${opts.chunkIndex + 1} of ${opts.chunkTotal}`,
    isFinalChunk
      ? 'FINAL CHUNK: keep the last paragraphs in full, including "end of section" / "check your answers" lines — they are document content.'
      : null,
    `Blocks: ${blocks.length} (labels [B1]…[B${blocks.length || 1}])`,
    'Select unnecessary chrome only. If unsure, remove nothing. Do not rewrite the text.',
    'Return JSON: {"removeBlocks":[],"removeSnippets":[],"dropChapter":false,"title":""}',
    '---',
    labeled || opts.text,
    '---',
  ]
    .filter(Boolean)
    .join('\n');
}

export function mergeChapterCleanup(
  original: ExtractedChapter,
  chunkResults: CleanupChunkResult[],
  originalChunks: string[] = [],
  remainder = '',
): ExtractedChapter | null {
  if (chunkResults.length === 0) return original;

  // Whole-chapter drop only when every chunk is empty/dropped.
  if (chunkResults.every((r) => r.dropChapter && !r.text.trim())) return null;

  const parts: string[] = [];
  for (let i = 0; i < chunkResults.length; i++) {
    const r = chunkResults[i];
    // Partial dropChapter must not erase trailing body — keep original chunk.
    if (r.dropChapter && !r.text.trim()) {
      const fallback = originalChunks[i];
      if (fallback?.trim()) {
        parts.push(cleanImportPlainText(fallback));
      }
      continue;
    }
    const cleaned = cleanImportPlainText(r.text);
    if (cleaned) parts.push(cleaned);
  }

  const rem = cleanImportPlainText(remainder);
  if (rem) parts.push(rem);

  if (parts.length === 0) return null;

  const merged = parts.join('\n\n').trim();
  if (!shouldKeepCleanedText(original.text, merged)) {
    logger.debug(
      `Keeping original chapter "${original.title}" — AI removal looked over-trimmed`,
    );
    return original;
  }
  if (isProtectedLearningText(original.text) && !isProtectedLearningText(merged)) {
    logger.debug(
      `Keeping original chapter "${original.title}" — protected learning wrap-up was removed`,
    );
    return original;
  }

  const titleFromModel = chunkResults.map((r) => r.title?.trim()).find(Boolean);
  return {
    title: (titleFromModel || original.title || 'Imported text').slice(0, 200),
    text: merged,
  };
}

export type ImportCleanupPlanItem = {
  chapter: ExtractedChapter;
  index: number;
  chunks: string[];
  /** Text after AI-covered chunks (budget / chunk-cap leftover). Always kept as-is. */
  remainder: string;
};

export function planImportCleanup(chapters: ExtractedChapter[]): ImportCleanupPlanItem[] {
  let budget = IMPORT_AI_MAX_TOTAL_CHARS;
  let chunkBudget = IMPORT_AI_MAX_CHUNKS;
  const plan: ImportCleanupPlanItem[] = [];

  for (let i = 0; i < chapters.length; i++) {
    const chapter = chapters[i];
    const words = countWords(chapter.text);
    if (words < IMPORT_AI_MIN_CHAPTER_WORDS) continue;
    if (budget <= 0 || chunkBudget <= 0) break;

    const withinBudget =
      chapter.text.length > budget ? chapter.text.slice(0, budget) : chapter.text;
    const afterBudget =
      chapter.text.length > budget ? chapter.text.slice(budget) : '';
    const allChunks = splitForImportAi(withinBudget);
    const chunks = allChunks.slice(0, chunkBudget);
    if (chunks.length === 0) continue;

    const unusedChunks = allChunks.slice(chunks.length);
    const remainder = [...unusedChunks, afterBudget]
      .map((t) => t.trim())
      .filter(Boolean)
      .join('\n\n');

    plan.push({ chapter, index: i, chunks, remainder });
    budget -= withinBudget.length;
    chunkBudget -= chunks.length;
  }

  return plan;
}
