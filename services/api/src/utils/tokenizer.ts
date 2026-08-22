import type { TokenMapEntry, SentenceMapEntry } from '@gotcha/shared';
import { restoreDialogueLayout, splitDialogueAwareUnits } from '../modules/imports/dialogue-layout';

const WORD_RE = /[\p{L}\p{M}']+/u;

/**
 * Import / reader pagination rule (product chooses shorter reader pages).
 * Target ~100 words, max ~150. Prefer paragraph, then sentence, boundaries.
 * Spoken conversation stays line-by-line; pages break between complete turns.
 */
export const TARGET_SEGMENT_WORDS = 100;
export const MAX_SEGMENT_WORDS = 150;

export interface TextChunk {
  plainText: string;
  title: string;
  wordCount: number;
}

function countWords(text: string): number {
  const m = text.match(/[\p{L}\p{M}']+/gu);
  return m?.length ?? 0;
}

function splitSentences(text: string): string[] {
  const parts: string[] = [];
  const re = /[.!?…]+["')\]]*(?:\s+|$)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const end = match.index + match[0].length;
    const slice = text.slice(last, end).trim();
    if (slice) parts.push(slice);
    last = end;
  }
  const tail = text.slice(last).trim();
  if (tail) parts.push(tail);
  return parts.length > 0 ? parts : [text.trim()].filter(Boolean);
}

function flushChunk(
  chunks: TextChunk[],
  buffer: Array<{ text: string; join: '\n' | '\n\n' }>,
  index: number,
) {
  if (!buffer.length) return;
  const plainText = buffer
    .reduce((acc, piece, i) => (i === 0 ? piece.text : acc + piece.join + piece.text), '')
    .trim();
  if (!plainText) return;
  chunks.push({
    plainText,
    title: `Page ${index + 1}`,
    wordCount: countWords(plainText),
  });
}

/**
 * Split long import text into reader pages / ContentSegments.
 * Prefer paragraph breaks, then sentence ends; never exceed MAX_SEGMENT_WORDS
 * except when a single paragraph/sentence/turn is longer (then hard-split by words).
 * Dialogue stays line-by-line; pages break between spoken turns, not mid-line.
 */
export function paginateText(
  text: string,
  targetWords = TARGET_SEGMENT_WORDS,
  maxWords = MAX_SEGMENT_WORDS,
): TextChunk[] {
  const normalized = restoreDialogueLayout(text.replace(/\r\n/g, '\n')).trim();
  if (!normalized) return [];

  const totalWords = countWords(normalized);
  if (totalWords <= maxWords) {
    return [
      {
        plainText: normalized,
        title: 'Page 1',
        wordCount: totalWords,
      },
    ];
  }

  const chunks: TextChunk[] = [];
  let buffer: Array<{ text: string; join: '\n' | '\n\n' }> = [];
  let bufferWords = 0;
  let lastKind: 'prose' | 'dialogue' | null = null;

  const hardSplitByWords = (unit: string) => {
    const wordTokens = unit.match(/[\p{L}\p{M}']+[^\p{L}\p{M}']*/gu) ?? [unit];
    let hard: string[] = [];
    let hardWords = 0;
    for (const tok of wordTokens) {
      const w = countWords(tok);
      if (hardWords > 0 && hardWords + w > targetWords) {
        flushChunk(chunks, [{ text: hard.join('').trim(), join: '\n\n' }], chunks.length);
        hard = [];
        hardWords = 0;
      }
      hard.push(tok);
      hardWords += w;
    }
    if (hard.length) {
      flushChunk(chunks, [{ text: hard.join('').trim(), join: '\n\n' }], chunks.length);
    }
  };

  const pushPiece = (unit: string, kind: 'prose' | 'dialogue') => {
    const words = countWords(unit);
    if (words === 0) return;

    if (words > maxWords) {
      if (buffer.length) {
        flushChunk(chunks, buffer, chunks.length);
        buffer = [];
        bufferWords = 0;
        lastKind = null;
      }
      hardSplitByWords(unit);
      return;
    }

    if (
      bufferWords > 0 &&
      (bufferWords + words > maxWords || bufferWords + words > targetWords)
    ) {
      flushChunk(chunks, buffer, chunks.length);
      buffer = [];
      bufferWords = 0;
      lastKind = null;
    }

    const join: '\n' | '\n\n' = kind === 'dialogue' && lastKind === 'dialogue' ? '\n' : '\n\n';
    buffer.push({ text: unit, join });
    bufferWords += words;
    lastKind = kind;
  };

  for (const block of splitDialogueAwareUnits(normalized)) {
    if (block.kind === 'dialogue') {
      const turns = block.text.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
      for (const turn of turns) {
        pushPiece(turn, 'dialogue');
      }
      continue;
    }

    const paraWords = countWords(block.text);
    if (paraWords > targetWords) {
      for (const sentence of splitSentences(block.text)) {
        pushPiece(sentence, 'prose');
      }
    } else {
      pushPiece(block.text, 'prose');
    }
  }

  if (buffer.length) {
    flushChunk(chunks, buffer, chunks.length);
  }

  return chunks.length > 0
    ? chunks
    : [{ plainText: normalized, title: 'Page 1', wordCount: totalWords }];
}

export function tokenizeText(text: string): {
  tokenMap: TokenMapEntry[];
  sentenceMap: SentenceMapEntry[];
  wordCount: number;
} {
  const tokenMap: TokenMapEntry[] = [];
  const sentenceMap: SentenceMapEntry[] = [];
  let wordCount = 0;
  let tokenIndex = 0;

  const boundaries: number[] = [0];
  let match: RegExpExecArray | null;
  const boundaryRe = /[.!?…]+["')\]]*\s+/g;
  while ((match = boundaryRe.exec(text)) !== null) {
    boundaries.push(match.index + match[0].length);
  }
  if (boundaries[boundaries.length - 1] !== text.length) {
    boundaries.push(text.length);
  }

  for (let s = 0; s < boundaries.length - 1; s++) {
    const start = boundaries[s];
    const end = boundaries[s + 1];
    if (end <= start) continue;
    sentenceMap.push({ index: s, start, end });
  }

  const wordRe = new RegExp(WORD_RE.source, 'gu');
  while ((match = wordRe.exec(text)) !== null) {
    const surface = match[0];
    const start = match.index;
    const end = start + surface.length;

    if (start > tokenIndex) {
      const gap = text.slice(tokenIndex, start);
      if (gap.length > 0) {
        tokenMap.push({
          i: tokenMap.length,
          start: tokenIndex,
          end: start,
          surface: gap,
          lemma: null,
          isWord: false,
        });
      }
    }

    tokenMap.push({
      i: tokenMap.length,
      start,
      end,
      surface,
      lemma: surface.toLowerCase(),
      isWord: true,
    });
    wordCount++;
    tokenIndex = end;
  }

  if (tokenIndex < text.length) {
    tokenMap.push({
      i: tokenMap.length,
      start: tokenIndex,
      end: text.length,
      surface: text.slice(tokenIndex),
      lemma: null,
      isWord: false,
    });
  }

  return { tokenMap, sentenceMap, wordCount };
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export function uniqueWordCount(tokenMap: TokenMapEntry[]): number {
  const lemmas = new Set<string>();
  for (const t of tokenMap) {
    if (t.isWord && t.lemma) lemmas.add(t.lemma);
  }
  return lemmas.size;
}
