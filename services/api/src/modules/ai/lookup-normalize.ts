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
export const LOOKUP_CACHE_VERSION = 'v13'; // v13: Uzbek Latin + ʻ orthography, comma meanings kept (accuracy pass 2026-11-04)

export type LookupKind = 'word' | 'phrase' | 'sentence';

export const LOOKUP_SYSTEM_PROMPT = `You are a bilingual glossary for a language-learning reader.
SOURCE LANGUAGE and GLOSS LANGUAGE are named in the user message (full name + ISO code).
Write translation and contextualMeaning ONLY in GLOSS LANGUAGE. Never default to English, Russian, or Uzbek unless that is the requested GLOSS LANGUAGE.
Uzbek (uz) is ALWAYS the modern Latin alphabet, never Cyrillic. Spell oʻ and gʻ with ʻ (U+02BB) and the tutuq belgisi with ʼ (U+02BC): "oʻtmoq", "gʻalaba", "maʼno". Use natural, everyday literary Uzbek a teacher would write — not word-by-word calques of English.
Return ONLY JSON: {"lemma":"","partOfSpeech":"","translation":"","contextualMeaning":"","phraseIfAny":null}

PART OF SPEECH:
- partOfSpeech = the role of TARGET in THIS SENTENCE, one of: noun, verb, adjective, adverb, pronoun, preposition, conjunction, determiner, interjection, numeral, particle, phrase.
- translation MUST keep that part of speech: a noun gets a noun gloss, a verb gets a verb gloss. Bad: "hesitation" (noun) → "ikkilanmoq" (verb). Good: "hesitation" → "ikkilanish".

DOMAIN: Use only a sense that fits THIS SENTENCE (ships, hunting, weather, people, literature, daily talk).
Never pick software, IT, business-process, sports, gambling, finance, or slang senses unless the sentence is clearly about those.
Bad for a sea chase: "run" → execute/implement. Good: overtake / pass.

TENSE vs IDIOM:
- have/has/had/did + verb is tense, not the meaning. Do not gloss the auxiliary alone (have ≠ bor/есть).
- If a particle sits near the verb (by, out, up, off, down, over, through), phraseIfAny MUST include that phrasal verb copied from SENTENCE ("run him by", "look outs", "at hand").

WORD (TARGET is one token):
- translation = dictionary/base gloss of THIS WORD in GLOSS LANGUAGE (1–3 words), the sense used HERE. No "or"/"yoki"/"или" lists.
- contextualMeaning = ONE natural meaning as used HERE (2–12 words), a short phrase or clause in GLOSS LANGUAGE. Not a comma-joined synonym dump.
- Accuracy first: pick the sense the author means in THIS sentence (literal vs figurative, tense, register). If the word is part of a fixed expression, gloss the expression.
- phraseIfAny = exact 2–6 word idiom/phrasal span from SENTENCE, else null.
- lemma = dictionary headword.

Examples when GLOSS LANGUAGE is uz:
TARGET "hesitation" / SENTENCE "She answered without any hesitation." → {"lemma":"hesitation","partOfSpeech":"noun","translation":"ikkilanish","contextualMeaning":"hech ikkilanmasdan, darhol","phraseIfAny":null}
TARGET "hand" / SENTENCE "Nothing! and noon at hand!" → {"lemma":"hand","translation":"yaqin","contextualMeaning":"yaqin vaqt","phraseIfAny":"at hand"}
TARGET "might" / SENTENCE "I might have known it, too." → {"lemma":"might","translation":"ehtimol","contextualMeaning":"oldin bilish yoki taxmin qilish","phraseIfAny":"might have known"}
TARGET "outs" / SENTENCE "the regular look outs" → {"lemma":"lookout","translation":"qorovullar","contextualMeaning":"kemadagi kuzatuvchilar","phraseIfAny":"look outs"}
TARGET "have run" / SENTENCE "Aye, aye, I have run him by last night." → {"lemma":"run by","translation":"quvib oʻtmoq","contextualMeaning":"kechasi orqadan oʻtib ketmoq","phraseIfAny":"run him by"}
TARGET "run" / SENTENCE "Aye, aye, I have run him by last night." → {"lemma":"run by","translation":"quvib oʻtmoq","contextualMeaning":"orqadan oʻtib ketmoq","phraseIfAny":"run him by"}

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
  // Lookup bug (a): join soft-wrapped / hyphen-broken lines into one sentence.
  const trimmed = (text ?? '')
    .replace(/(\p{L})-[ \t]*\r?\n[ \t]*(\p{Ll})/gu, '$1$2')
    .replace(/\s+/g, ' ')
    .trim();
  if (trimmed.length <= LOOKUP_CONTEXT_MAX) return trimmed;
  return trimmed.slice(0, LOOKUP_CONTEXT_MAX).trim();
}

const POS_VALUES = new Set([
  'noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction',
  'determiner', 'interjection', 'numeral', 'particle', 'phrase',
]);
const POS_ALIASES: Record<string, string> = {
  n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', pron: 'pronoun', prep: 'preposition',
  conj: 'conjunction', det: 'determiner', article: 'determiner', interj: 'interjection', num: 'numeral',
  'phrasal verb': 'phrase', idiom: 'phrase',
};
/** Lookup bug (c): keep only a known English POS tag; anything else → null. */
export function normalizePartOfSpeech(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const k = raw.trim().toLowerCase().replace(/\.$/, '');
  const v = POS_ALIASES[k] ?? k;
  return POS_VALUES.has(v) ? v : null;
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
  if (looksLikeOffDomainExecute(t, sentence)) return null;
  if (looksLikeSynonymDump(t)) {
    // Keep the first sense instead of dropping the whole meaning (and paying for a repair call).
    const parts = t.split(/[,;/]| - /).map((part) => part.trim()).filter(Boolean);
    const first = parts.find((part) => !sameLooseText(part, fallbackGloss)) ?? '';
    // A 2-part natural phrase ("hech ikkilanmasdan, darhol") is fine as-is; only trim real lists (3+ parts).
    t = parts.length >= 3 ? first : t;
    if (!t) return null;
  }
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
  if (words.length >= 5) return true;
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

/** Uzbek output: Latin ʻ/ʼ orthography (models often answer with ASCII ' or ‘ ’). */
export function normalizeUzbekOrthography(text: string): string {
  if (!text) return text;
  return text
    .replace(/([OoGg])['‘’`ʼ]/g, '$1ʻ')
    .replace(/(\p{L})['’`](\p{L})/gu, '$1ʼ$2')
    // A model that uses ʻ for every apostrophe would turn "maʻno" into the o/g mark. Tutuq stays ʼ.
    .replace(/(?<![OoGg])(?<=\p{L})ʻ(?=\p{L})/gu, 'ʼ');
}

/** Uzbek gloss came back in Cyrillic (or mostly Cyrillic) — worth one repair pass. */
export function looksLikeWrongScript(text: string | null | undefined, targetLang: string): boolean {
  if (!text || targetLang !== 'uz') return false;
  const cyr = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const letters = (text.match(/\p{L}/gu) ?? []).length;
  return letters > 0 && cyr / letters > 0.3;
}
