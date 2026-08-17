/** Shared helpers for tapping/holding multi-word phrases in reader + chat. */

export const LOOKUP_PHRASE_MAX_WORDS = 8;
/** Learner can drag a whole reader page. */
export const LOOKUP_SELECTION_MAX_WORDS = 400;

export function isSentenceLikeSelection(surface: string, sentence?: string): boolean {
  const words = (surface ?? '').trim().split(/\s+/).filter(Boolean).length;
  if (words <= 1) return false;
  if (words > LOOKUP_PHRASE_MAX_WORDS) return true;
  if (/[.!?…。！？]/.test(surface) && words >= 3) return true;
  if (sentence) {
    const a = normalizeLookupSurface(surface);
    const b = normalizeLookupSurface(sentence);
    if (a.length >= 12 && (a === b || (b.startsWith(a) && words >= 5))) return true;
  }
  return false;
}

export function lookupHeadline(surface: string, phrase?: string | null, lemma?: string | null): string {
  if (isSentenceLikeSelection(surface)) {
    const words = surface.trim().split(/\s+/).filter(Boolean);
    if (words.length <= 12 && surface.trim().length <= 80) return surface.trim();
    return `${words.slice(0, 12).join(' ').slice(0, 80).trim()}…`;
  }
  return (phrase?.trim() || lemma?.trim() || surface).trim();
}

/** Vocab Save/Known/Ignore is for a single tapped word, not a dragged phrase/sentence/page. */
export function isVocabMarkableSelection(
  surface: string,
  tokenCount?: number,
  kind?: string | null,
): boolean {
  if (kind === 'sentence') return false;
  if (isSentenceLikeSelection(surface)) return false;
  if (typeof tokenCount === 'number' && tokenCount > 1) return false;
  return (surface ?? '').trim().split(/\s+/).filter(Boolean).length <= 1;
}

export function normalizeLookupSurface(raw: string): string {
  return (raw ?? '')
    .toLowerCase()
    .replace(/^[\s"'«»„“”‘’(\[{<]+|[\s"'«»„“”‘’).,!?;:…\]}>]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export type PhraseToken = { i: number; surface: string; lemma?: string | null };

export type TokenSpan = { startI: number; endI: number };

function tokenMatchesPart(token: PhraseToken, part: string) {
  const surf = normalizeLookupSurface(token.surface).replace(/-/g, '');
  const want = part.replace(/-/g, '');
  if (surf === want) return true;
  const lemma = normalizeLookupSurface(token.lemma ?? '').replace(/-/g, '');
  return Boolean(lemma && lemma === want);
}

export function findPhraseTokenRange(
  tokens: PhraseToken[],
  phrase: string,
  preferAround?: number,
): TokenSpan | null {
  const parts = phrase.trim().split(/[\s-]+/).map(normalizeLookupSurface).filter(Boolean);
  if (!parts.length) return null;
  const hits: TokenSpan[] = [];

  if (parts.length >= 2) {
    for (let i = 0; i <= tokens.length - parts.length; i += 1) {
      const window = tokens.slice(i, i + parts.length);
      if (window.every((token, j) => tokenMatchesPart(token, parts[j]!))) {
        hits.push({ startI: window[0]!.i, endI: window[window.length - 1]!.i });
      }
    }
  }

  const closed = parts.join('').replace(/-/g, '');
  if (closed.length >= 6) {
    for (let n = 2; n <= Math.min(3, tokens.length); n += 1) {
      for (let i = 0; i <= tokens.length - n; i += 1) {
        const window = tokens.slice(i, i + n);
        const concat = window
          .map((token) => normalizeLookupSurface(token.surface).replace(/-/g, ''))
          .join('');
        if (concat === closed) {
          hits.push({ startI: window[0]!.i, endI: window[window.length - 1]!.i });
        }
      }
    }
  }

  if (!hits.length) return null;
  const unique = hits.filter(
    (hit, index) => hits.findIndex((other) => other.startI === hit.startI && other.endI === hit.endI) === index,
  );
  if (preferAround == null) return unique[0] ?? null;
  return unique.find((hit) => preferAround >= hit.startI && preferAround <= hit.endI) ?? unique[0] ?? null;
}

export function findChatWordPartRange(
  parts: Array<{ type: 'word' | 'text'; value: string }>,
  selected: string,
): TokenSpan | null {
  const wordParts: PhraseToken[] = [];
  parts.forEach((part, i) => {
    if (part.type === 'word') wordParts.push({ i, surface: part.value });
  });
  const phraseRange = findPhraseTokenRange(wordParts, selected);
  if (phraseRange) return phraseRange;
  const one = normalizeLookupSurface(selected);
  if (!one || one.includes(' ')) return null;
  const hit = wordParts.find((token) => normalizeLookupSurface(token.surface) === one);
  return hit ? { startI: hit.i, endI: hit.i } : null;
}

export function clampPhraseSpan(tokens: PhraseToken[], a: number, b: number): TokenSpan | null {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const inRange = tokens.filter((token) => token.i >= lo && token.i <= hi);
  if (!inRange.length) return null;
  const sliced = inRange.slice(0, LOOKUP_SELECTION_MAX_WORDS);
  return { startI: sliced[0]!.i, endI: sliced[sliced.length - 1]!.i };
}

export function tokenInSpan(tokenI: number, span: TokenSpan | null | undefined) {
  if (!span) return false;
  return tokenI >= span.startI && tokenI <= span.endI;
}

/** Sentence (or short window) containing the tapped span — never a full message/chapter. */
export function extractSentenceAround(text: string, start: number, end: number): string {
  if (!text) return '';
  const len = text.length;
  const a = Math.max(0, Math.min(start, len));
  const b = Math.max(a, Math.min(end, len));

  let s = a;
  while (s > 0) {
    const ch = text[s - 1];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n' || ch === '…') break;
    s--;
  }
  while (s < a && /\s/.test(text[s]!)) s++;

  let e = b;
  while (e < len) {
    const ch = text[e]!;
    if (ch === '.' || ch === '!' || ch === '?' || ch === '…') {
      e++;
      break;
    }
    if (ch === '\n') break;
    e++;
  }

  let sentence = text.slice(s, e).trim();
  if (b - a > 280) {
    return text.slice(a, b).trim().slice(0, 4000);
  }
  if (sentence.length > 280) {
    const ws = Math.max(0, a - 60);
    const we = Math.min(len, b + 60);
    sentence = text.slice(ws, we).trim();
  }
  return sentence.slice(0, 400);
}

export function sentenceAroundPhrase(text: string, phrase: string): string {
  const needle = phrase.trim();
  if (!text) return '';
  if (!needle) return text.slice(0, 280);
  const lower = text.toLowerCase();
  const idx = lower.indexOf(needle.toLowerCase());
  if (idx >= 0) return extractSentenceAround(text, idx, idx + needle.length);
  const first = needle.split(/\s+/)[0] ?? needle;
  const fallback = lower.indexOf(first.toLowerCase());
  if (fallback >= 0) return extractSentenceAround(text, fallback, fallback + first.length);
  return text.slice(0, 280);
}
