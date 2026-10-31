/** Shared lookup classification + sanitizers (reader + chat hit the same AI path). */

export const LOOKUP_CONTEXT_MAX = 4000;
export const LOOKUP_GLOSS_MAX_CHARS = 80;
export const LOOKUP_GLOSS_MAX_WORDS = 8;
export const LOOKUP_SENTENCE_GLOSS_MAX_CHARS = 4000;
export const LOOKUP_SENTENCE_GLOSS_MAX_WORDS = 400;
export const LOOKUP_CONTEXTUAL_MAX_CHARS = 140;
export const LOOKUP_CONTEXTUAL_MAX_WORDS = 16;
export const LOOKUP_PHRASE_MAX_WORDS = 8;
export const LOOKUP_PHRASE_MAX_CHARS = 80;
/** Bump when prompt/normalization changes so stale lemma_cache rows are skipped. */
export const LOOKUP_CACHE_VERSION = 'v11';

export type LookupKind = 'word' | 'phrase' | 'sentence';

export const LOOKUP_SYSTEM_PROMPT = `You are a bilingual glossary for a language-learning reader.
SOURCE LANGUAGE and GLOSS LANGUAGE are named in the user message (full name + ISO code).
Write translation and contextualMeaning ONLY in GLOSS LANGUAGE. Never default to English, Russian, or Uzbek unless that is the requested GLOSS LANGUAGE.
Return ONLY JSON: {"lemma":"","translation":"","contextualMeaning":"","phraseIfAny":null}

DOMAIN: Use only a sense that fits THIS SENTENCE (ships, hunting, weather, people, literature, daily talk).
Never pick software, IT, business-process, sports, gambling, finance, or slang senses unless the sentence is clearly about those.
Bad for a sea chase: "run" → execute/implement. Good: overtake / pass.

TENSE vs IDIOM:
- have/has/had/did + verb is tense, not the meaning. Do not gloss the auxiliary alone (have ≠ bor/есть).
- If a particle sits near the verb (by, out, up, off, down, over, through), phraseIfAny MUST include that phrasal verb copied from SENTENCE ("run him by", "look outs", "at hand").

WORD (TARGET is one token):
- translation = dictionary/base gloss of THIS WORD in GLOSS LANGUAGE (1–3 words), the sense used HERE. No "or"/"yoki"/"или" lists.
- contextualMeaning = ONE natural meaning as used HERE (2–12 words). Not a comma-joined synonym dump.
- phraseIfAny = exact 2–6 word idiom/phrasal span from SENTENCE, else null.
- lemma = dictionary headword.

Examples when GLOSS LANGUAGE is uz:
TARGET "hand" / SENTENCE "Nothing! and noon at hand!" → {"lemma":"hand","translation":"yaqin","contextualMeaning":"yaqin vaqt","phraseIfAny":"at hand"}
TARGET "might" / SENTENCE "I might have known it, too." → {"lemma":"might","translation":"ehtimol","contextualMeaning":"oldin bilish yoki taxmin qilish","phraseIfAny":"might have known"}
TARGET "outs" / SENTENCE "the regular look outs" → {"lemma":"lookout","translation":"qorovullar","contextualMeaning":"kemadagi kuzatuvchilar","phraseIfAny":"look outs"}
TARGET "have run" / SENTENCE "Aye, aye, I have run him by last night." → {"lemma":"run by","translation":"quvib o'tmoq","contextualMeaning":"kechasi orqadan o'tib ketmoq","phraseIfAny":"run him by"}
TARGET "run" / SENTENCE "Aye, aye, I have run him by last night." → {"lemma":"run by","translation":"quvib o'tmoq","contextualMeaning":"orqadan o'tib ketmoq","phraseIfAny":"run him by"}

PHRASE (TARGET is 2–8 words and is not a full sentence):
- If TARGET is only a slice (have run), expand phraseIfAny to the real phrasal span in SENTENCE (run him by).
- translation = short gloss of that WHOLE phrase as used here, never of the auxiliary alone.
- contextualMeaning = how it is used in THIS sentence (one sense, no synonym lists).
- Do not translate the rest of SENTENCE.

SENTENCE / LONG TARGET (a clause, a full sentence, TARGET ≈ SENTENCE, or many words):
- phraseIfAny = null
- contextualMeaning = null
- translation = the COMPLETE translation of TARGET into GLOSS LANGUAGE. Keep every clause. Do not summarize, omit, or compress.
- lemma = first few words of TARGET

Never translate the whole SENTENCE when TARGET is a short word or idiom. No grammar lectures.`;

export function compactLookupText(raw: string) {
  return raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, ' ')
    .replace(/[-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lookupWordCount(surface: string): number {
  return compactLookupText(surface).split(' ').filter(Boolean).length;
}

export function classifyLookup(surface: string, sentence: string): LookupKind {
  const words = lookupWordCount(surface);
  if (words <= 1) return 'word';

  const compactSurf = compactLookupText(surface);
  const compactSent = compactLookupText(sentence);
  const sentWords = compactSent.split(' ').filter(Boolean).length;
  const punctuated = /[.!?…。！？]/.test(surface.trim());
  const coversSentence =
    compactSurf.length >= 12 &&
    (compactSurf === compactSent ||
      (sentWords > 0 && words >= Math.max(5, Math.ceil(sentWords * 0.75))));
  const long = words > LOOKUP_PHRASE_MAX_WORDS || surface.trim().length > LOOKUP_PHRASE_MAX_CHARS;

  if (long || coversSentence || (punctuated && words >= 3)) return 'sentence';
  return 'phrase';
}

export function sameLooseText(a: string, b: string) {
  return a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function clampContext(text: string): string {
  const trimmed = (text ?? '').trim();
  if (trimmed.length <= LOOKUP_CONTEXT_MAX) return trimmed;
  return trimmed.slice(0, LOOKUP_CONTEXT_MAX).trim();
}

export function normalizeLemmaKey(raw: string): string {
  return (raw ?? '')
    .toLowerCase()
    .trim()
    .replace(/^[\s"'«»„“”‘’(\[{<]+|[\s"'«»„“”‘’).,!?;:…\]}>]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeSentenceForHash(raw: string): string {
  return clampContext(raw)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^[\s"'«»„“”‘’]+|[\s"'«»„“”‘’]+$/g, '')
    .trim();
}

export function glossLimitsFor(kind: LookupKind): { maxChars: number; maxWords: number } {
  if (kind === 'sentence') {
    return { maxChars: LOOKUP_SENTENCE_GLOSS_MAX_CHARS, maxWords: LOOKUP_SENTENCE_GLOSS_MAX_WORDS };
  }
  return { maxChars: LOOKUP_GLOSS_MAX_CHARS, maxWords: LOOKUP_GLOSS_MAX_WORDS };
}

export function sanitizeGloss(
  raw: unknown,
  fallback: string,
  limits: { maxChars: number; maxWords: number },
  kind: LookupKind = 'word',
): string {
  if (typeof raw !== 'string') return fallback;
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return fallback;

  if (kind === 'sentence') {
    if (t.length > limits.maxChars) t = t.slice(0, limits.maxChars).trim();
    return t || fallback;
  }

  const wordCount = t.split(/\s+/).filter(Boolean).length;
  const sentenceEnds = (t.match(/[.!?。！？]/g) ?? []).length;
  const looksLikePassage = t.length > limits.maxChars || wordCount > limits.maxWords || sentenceEnds > 1;

  if (looksLikePassage) {
    const chunk = t.split(/[,;–—:：]/)[0]?.trim() ?? t;
    if (chunk.split(/\s+/).length <= limits.maxWords && chunk.length <= limits.maxChars) {
      t = chunk;
    } else {
      t = t.split(/\s+/).slice(0, Math.min(6, limits.maxWords)).join(' ');
    }
  }

  if (t.length > limits.maxChars) {
    t = t.slice(0, limits.maxChars).trim();
  }
  return t || fallback;
}

export function sanitizeContextualMeaning(
  raw: unknown,
  fallbackGloss: string,
  kind: LookupKind = 'word',
  sentence = '',
): string | null {
  if (kind === 'sentence') return null;
  if (typeof raw !== 'string') return null;
  let t = raw.replace(/\s+/g, ' ').trim();
  if (!t) return null;
  if (looksLikeSynonymDump(t) || looksLikeOffDomainExecute(t, sentence)) return null;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > LOOKUP_CONTEXTUAL_MAX_WORDS) t = words.slice(0, LOOKUP_CONTEXTUAL_MAX_WORDS).join(' ');
  if (t.length > LOOKUP_CONTEXTUAL_MAX_CHARS) t = t.slice(0, LOOKUP_CONTEXTUAL_MAX_CHARS).trim();
  if (!t) return null;
  if (sameLooseText(t, fallbackGloss)) return null;
  return t;
}

export function sanitizePhrase(
  raw: unknown,
  sentence: string,
  surface: string,
  kind: LookupKind = 'word',
): string | null {
  if (kind === 'sentence') return null;
  if (typeof raw !== 'string') return null;
  let t = raw.replace(/\s+/g, ' ').trim();
  t = t.replace(/^[\s"'«»„“”‘’]+|[\s"'«»„“”‘’.,!?;:]+$/g, '').trim();
  if (!t) return null;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > LOOKUP_PHRASE_MAX_WORDS || t.length > LOOKUP_PHRASE_MAX_CHARS) {
    return null;
  }
  const needle = compactLookupText(t);
  const hay = compactLookupText(sentence);
  if (!needle) return null;
  if (hay && needle === hay && needle.split(' ').length > LOOKUP_PHRASE_MAX_WORDS) return null;
  const closed = needle.replace(/ /g, '');
  const hayClosed = hay.replace(/ /g, '');
  if (
    hay.includes(needle)
    || compactLookupText(surface) === needle
    || (closed.length >= 6 && hayClosed.includes(closed))
  ) {
    return t;
  }
  return null;
}

export function displaySentenceHead(surface: string): string {
  const trimmed = surface.replace(/\s+/g, ' ').trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 12 && trimmed.length <= 80) return trimmed;
  const sliced = words.slice(0, 12).join(' ');
  return `${sliced.slice(0, 80).trim()}…`;
}

export function looksLikeDefinitionGloss(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 4) return true;
  if (/\b(or|yoki|или|oder)\b/i.test(t)) return true;
  if (/(a person who|someone who|the act of|the state of)/i.test(t)) return true;
  return false;
}

const IT_EXECUTE_MARKERS = [
  'amalga oshirish',
  'bajarish',
  'ishga tushirish',
  'dasturni',
  'execute',
  'implement',
  'запустить',
  'выполнить',
  'реализовать',
];

const AUXILIARY_GLOSSES = new Set([
  'bor', 'have', 'has', 'had', 'did', 'do', 'does', 'will', 'would',
  'есть', 'иметь', 'был', 'была',
]);

export function looksLikeSynonymDump(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return t.split(/[,;/]| - /).map((part) => part.trim()).filter(Boolean).length >= 2;
}

export function sentenceLooksTechnical(sentence: string): boolean {
  return /\b(software|computer|program|code|server|app|database|click|download|algorithm|script)\b/i.test(
    sentence,
  );
}

export function looksLikeOffDomainExecute(text: string, sentence: string): boolean {
  if (!text?.trim() || sentenceLooksTechnical(sentence)) return false;
  const t = text.toLowerCase();
  return IT_EXECUTE_MARKERS.some((marker) => t.includes(marker));
}

export function looksLikeAuxiliaryOnlyGloss(translation: string, surface: string, kind: LookupKind): boolean {
  if (kind === 'sentence') return false;
  const words = compactLookupText(surface).split(' ').filter(Boolean);
  if (words.length < 2) return false;
  const gloss = compactLookupText(translation);
  return Boolean(gloss) && AUXILIARY_GLOSSES.has(gloss);
}

export function needsLookupRepair(opts: {
  kind: LookupKind;
  surface: string;
  sentence: string;
  translation: string;
  contextualMeaning: string | null;
}): boolean {
  const { kind, surface, sentence, translation, contextualMeaning } = opts;
  if (kind === 'sentence') return false;
  if (contextualMeaning && looksLikeSynonymDump(contextualMeaning)) return true;
  if (looksLikeOffDomainExecute(contextualMeaning ?? '', sentence)) return true;
  if (looksLikeOffDomainExecute(translation, sentence)) return true;
  if (looksLikeAuxiliaryOnlyGloss(translation, surface, kind)) return true;
  return false;
}

export function packLookupNote(contextual: string | null, phrase: string | null): string | null {
  if (!phrase) return contextual;
  return JSON.stringify({ v: 1, contextualMeaning: contextual, phrase });
}

export function unpackLookupNote(raw: string | null | undefined): {
  contextualMeaning: string | null;
  phrase: string | null;
} {
  if (!raw?.trim()) return { contextualMeaning: null, phrase: null };
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { v?: number; contextualMeaning?: string | null; phrase?: string | null };
      if (parsed?.v === 1) {
        return {
          contextualMeaning: typeof parsed.contextualMeaning === 'string' ? parsed.contextualMeaning : null,
          phrase: typeof parsed.phrase === 'string' ? parsed.phrase : null,
        };
      }
    } catch {
      // Fall through to plain-text note.
    }
  }
  return { contextualMeaning: raw, phrase: null };
}

export function lookupMaxTokens(kind: LookupKind, surface: string): number {
  if (kind !== 'sentence') return 250;
  const words = lookupWordCount(surface);
  if (words > 80) return 1600;
  return Math.min(1200, Math.max(320, words * 10));
}
