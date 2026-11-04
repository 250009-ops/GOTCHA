import { api } from './api';
import { languageFlag, languageLabel } from './types';
import type { LookupResult } from './types';

export const CHAT_LANG_PAIR = ['EN', 'RU', 'UZ'] as const;

let enabledChatLangs: string[] = [...CHAT_LANG_PAIR];

export function setEnabledChatLangs(codes: string[]) {
  const next = codes.map((c) => c.toUpperCase().slice(0, 2)).filter(Boolean);
  if (next.length) enabledChatLangs = [...new Set(next)];
}

export function enabledChatLangCodes() {
  return enabledChatLangs;
}

const UZ_HINTS = new Set([
  'salom', 'rahmat', 'yaxshi', 'qanday', 'nima', 'nega', 'qayerda', 'qaysi', 'qachon',
  'bugun', 'kecha', 'vaqt', 'soat', 'tuman', 'tumani', 'viloyat', 'viloyati',
  'kitob', 'dost', "do'st", 'ha', 'yoq', "yo'q", 'men', 'sen', 'biz', 'ular',
  'kerak', 'mumkin', 'iltimos', 'kechirasiz', 'xafa', 'shunchalik', 'qolding',
  'qoldi', "bo'lib", 'bolib', 'uchun', 'bilan', 'endi', 'hali', 'emas', 'kerakmi',
]);

const EN_HINTS = new Set([
  'the', 'is', 'are', 'you', 'hello', 'hi', 'hey', 'thanks', 'and', 'this', 'that', 'have',
  'what', 'which', 'when', 'where', 'how', 'with', 'from', 'your', 'just', 'today',
]);

const LOOKUP_TOKEN_MAX = 4000;
const LOOKUP_SENTENCE_MAX = 4000;

const translationCache = new Map<string, string>();
let translateRouteMissing = false;
const translateOkCache = new Map<string, string>();

export function normalizeChatLang(code?: string | null): string {
  const next = (code ?? 'en').toUpperCase().slice(0, 2);
  return next || 'EN';
}

export function apiChatLang(code?: string | null): string {
  return normalizeChatLang(code).toLowerCase();
}

export function otherChatLangs(selected: string): string[] {
  const code = normalizeChatLang(selected);
  const pool = enabledChatLangs.length ? enabledChatLangs : [...CHAT_LANG_PAIR];
  return pool.filter((item) => item !== code);
}

export function learningTarget(
  native?: string | null,
  peerNative?: string | null,
  remaining?: string | null,
): string {
  const mine = normalizeChatLang(native);
  return (
    [peerNative, remaining, remaining, 'ru', 'uz', 'en']
      .filter(Boolean)
      .map((item) => normalizeChatLang(item))
      .find((item) => enabledChatLangs.includes(item) && item !== mine)
    ?? otherChatLangs(mine)[0]
    ?? 'EN'
  );
}

export function coerceToLang(native: string, selected?: string | null): string {
  const options = otherChatLangs(native);
  const code = selected ? normalizeChatLang(selected) : null;
  return code && options.includes(code) ? code : (options[0] ?? 'EN');
}

const FR_HINTS = new Set(['le', 'la', 'les', 'une', 'des', 'bonjour', 'merci', 'avec', 'pour', 'vous', 'est']);
const ES_HINTS = new Set(['el', 'los', 'las', 'hola', 'gracias', 'que', 'una', 'para', 'con', 'usted']);
const DE_HINTS = new Set(['der', 'die', 'das', 'und', 'nicht', 'ich', 'sie', 'ein', 'eine', 'hallo', 'danke']);
const PT_HINTS = new Set(['nao', 'não', 'voce', 'você', 'obrigado', 'ola', 'olá', 'uma', 'para', 'com']);

const IT_HINTS = new Set(['il', 'lo', 'gli', 'una', 'ciao', 'grazie', 'perche', 'perché', 'sono', 'questa']);
const NL_HINTS = new Set(['het', 'een', 'niet', 'voor', 'met', 'hallo', 'dank', 'zijn', 'deze']);
const TR_HINTS = new Set(['bir', 'degil', 'değil', 'icin', 'için', 'merhaba', 'tesekkur', 'teşekkür', 'ben', 'bu']);
const PL_HINTS = new Set(['nie', 'jest', 'dziekuje', 'dziękuję', 'czesc', 'cześć', 'tego', 'jestem']);
const SV_HINTS = new Set(['och', 'inte', 'det', 'hej', 'tack', 'jag', 'har', 'denna']);

export function detectChatLang(text: string): string | null {
  const letters = [...text].filter((ch) => /\p{L}/u.test(ch));
  if (letters.length === 0) return null;
  const allowed = new Set(enabledChatLangs);
  const pick = (code: string) => (allowed.has(code) ? code : null);

  if (letters.some((ch) => ch >= '\u3040' && ch <= '\u30FF')) return pick('JA') ?? pick('EN');
  if (letters.some((ch) => ch >= '\uAC00' && ch <= '\uD7AF')) return pick('KO') ?? pick('EN');
  if (letters.some((ch) => ch >= '\u4E00' && ch <= '\u9FFF')) return pick('ZH') ?? pick('JA') ?? pick('EN');
  if (letters.some((ch) => ch >= '\u0600' && ch <= '\u06FF')) {
    if (letters.some((ch) => 'پچژگ'.includes(ch))) return pick('FA') ?? pick('UR') ?? pick('AR');
    if (letters.some((ch) => 'ٹڈڑںےہھ'.includes(ch))) return pick('UR') ?? pick('AR');
    return pick('AR') ?? pick('FA') ?? pick('UR');
  }
  if (letters.some((ch) => ch >= '\u0590' && ch <= '\u05FF')) return pick('HE');
  if (letters.some((ch) => ch >= '\u0E00' && ch <= '\u0E7F')) return pick('TH');
  if (letters.some((ch) => ch >= '\u0900' && ch <= '\u097F')) return pick('HI') ?? pick('BN');
  if (letters.some((ch) => ch >= '\u0980' && ch <= '\u09FF')) return pick('BN');
  const cyr = letters.filter((ch) => ch >= '\u0400' && ch <= '\u04FF').length;
  if (cyr * 4 >= letters.length) {
    if (letters.some((ch) => 'іїєґІЇЄҐ'.includes(ch))) return pick('UK') ?? pick('RU');
    return pick('RU') ?? pick('UK') ?? pick('BG') ?? pick('SR') ?? pick('UZ') ?? pick('EN');
  }
  const lower = text.toLowerCase();
  if (/o['ʻʼ‘’]|g['ʻʼ‘’]|[ʻʼ]|oʻ|gʻ/.test(lower)) return pick('UZ') ?? pick('EN');
  const tokens = [...lower.matchAll(/[\p{L}']+/gu)].map((m) => m[0]);
  const score = (hints: Set<string>) => tokens.filter((t) => hints.has(t)).length;
  const ranked: Array<[string, number]> = [
    ['UZ', score(UZ_HINTS)],
    ['FR', score(FR_HINTS)],
    ['ES', score(ES_HINTS)],
    ['DE', score(DE_HINTS)],
    ['PT', score(PT_HINTS)],
    ['IT', score(IT_HINTS)],
    ['NL', score(NL_HINTS)],
    ['TR', score(TR_HINTS)],
    ['PL', score(PL_HINTS)],
    ['SV', score(SV_HINTS)],
    ['EN', score(EN_HINTS)],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  const best = ranked.find(([code, hits]) => hits > 0 && allowed.has(code));
  if (best) return best[0];
  // Latin Uzbek and English share a script — do not guess EN for unknown text.
  return null;
}

/** Composer chip is native. Treat typed text as native unless it is clearly the To language. */
export function inferComposerSource(text: string, nativeLang: string, toLang: string): string {
  const native = normalizeChatLang(nativeLang);
  const to = normalizeChatLang(toLang);
  const detected = detectChatLang(text);
  if (detected === to && to !== native) return to;
  if (detected === native) return native;
  return native;
}

export function sameChatText(a?: string | null, b?: string | null): boolean {
  if (!a?.trim() || !b?.trim()) return false;
  return a.trim().replace(/\s+/g, ' ').toLowerCase() === b.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function looksLikeLang(text: string, lang: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const want = normalizeChatLang(lang);
  const got = detectChatLang(trimmed);
  return Boolean(got && got === want);
}

export function chatLangName(code: string, uiLang?: string | null): string {
  const key = normalizeChatLang(code);
  const ui = normalizeChatLang(uiLang);
  const localized: Record<string, Record<string, string>> = {
    EN: { EN: 'English', RU: 'Английский', UZ: 'Inglizcha' },
    RU: { EN: 'Russian', RU: 'Русский', UZ: 'Ruscha' },
    UZ: { EN: 'Uzbek', RU: 'Узбекский', UZ: 'Oʻzbekcha' },
  };
  return localized[key]?.[ui] ?? languageLabel(key.toLowerCase());
}

/** Preposition in the To-language picker, in the learner’s UI language. */
export function chatToLabel(uiLang?: string | null): string {
  switch (normalizeChatLang(uiLang)) {
    case 'RU':
      return 'Перевод на';
    case 'UZ':
      return 'Tarjima tili';
    default:
      return 'Translate to';
  }
}

export function chatTranslateFailedLabel(uiLang?: string | null): string {
  switch (normalizeChatLang(uiLang)) {
    case 'RU':
      return 'Не удалось перевести';
    case 'UZ':
      return 'Tarjima qilib boʻlmadi';
    default:
      return "Couldn't translate";
  }
}

export function chatTranslatingLabel(uiLang?: string | null): string {
  switch (normalizeChatLang(uiLang)) {
    case 'RU':
      return 'Перевод…';
    case 'UZ':
      return 'Tarjima…';
    default:
      return 'Translating…';
  }
}

export function chatLangFlag(code: string): string {
  return languageFlag(normalizeChatLang(code).toLowerCase());
}

function toPrefKey(conversationId: string): string {
  return `gotcha_chat_to_${conversationId.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

export function loadToLang(conversationId: string): string | null {
  try {
    const raw = localStorage.getItem(toPrefKey(conversationId));
    return raw ? normalizeChatLang(raw) : null;
  } catch {
    return null;
  }
}

export function saveToLang(conversationId: string, lang: string): void {
  const code = normalizeChatLang(lang);
  if (!enabledChatLangs.includes(code)) return;
  try {
    localStorage.setItem(toPrefKey(conversationId), code);
  } catch {
    // ignore quota / private mode
  }
}

function trKey(text: string, src: string, dst: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return `${src}|${dst}|${text.length}|${hash}`;
}

export function cachedTranslation(text: string, sourceLang: string, targetLang: string): string | null {
  const src = normalizeChatLang(sourceLang);
  const dst = normalizeChatLang(targetLang);
  if (src === dst) return text;
  return translationCache.get(trKey(text, src, dst)) ?? null;
}

export function rememberTranslation(
  text: string,
  sourceLang: string,
  targetLang: string,
  translation: string,
): void {
  const src = normalizeChatLang(sourceLang);
  const dst = normalizeChatLang(targetLang);
  if (src === dst || !translation.trim() || sameChatText(text, translation)) return;
  translationCache.set(trKey(text, src, dst), translation);
}

function lookupChunks(text: string): string[] {
  if (text.length <= LOOKUP_TOKEN_MAX) return [text];
  const sentences = text.split(/(?<=[.!?…])\s+/).filter((part) => part.trim());
  const out: string[] = [];
  for (const sentence of sentences.length ? sentences : [text]) {
    if (sentence.length <= LOOKUP_TOKEN_MAX) {
      out.push(sentence);
      continue;
    }
    let buf = '';
    for (const word of sentence.split(/\s+/)) {
      if (buf && buf.length + 1 + word.length > LOOKUP_TOKEN_MAX) {
        out.push(buf);
        buf = '';
      }
      if (word.length > LOOKUP_TOKEN_MAX) {
        if (buf) {
          out.push(buf);
          buf = '';
        }
        out.push(word.slice(0, LOOKUP_TOKEN_MAX));
      } else {
        buf = buf ? `${buf} ${word}` : word;
      }
    }
    if (buf) out.push(buf);
  }
  return out.length ? out : [text.slice(0, LOOKUP_TOKEN_MAX)];
}

function acceptTranslation(original: string, raw?: string | null): string {
  const out = raw?.trim() ?? '';
  if (!out) throw new Error('Empty translation');
  if (sameChatText(out, original)) throw new Error('Translation unchanged');
  return out;
}

async function translateViaLookup(text: string, src: string, dst: string): Promise<string> {
  const parts = await Promise.all(
    lookupChunks(text).map(async (chunk) => {
      const token = chunk.slice(0, LOOKUP_TOKEN_MAX);
      const res = await api<LookupResult>('/ai/lookup', {
        method: 'POST',
        body: JSON.stringify({
          token,
          sentence: chunk.slice(0, LOOKUP_SENTENCE_MAX) || token,
          lemma: token.toLowerCase(),
          sourceLang: src,
          targetLang: dst,
        }),
      });
      const piece = res.translation?.trim() ?? '';
      if (!piece) throw new Error('Empty translation');
      return piece;
    }),
  );
  return acceptTranslation(text, parts.join(' ').trim());
}

export async function translateChat(
  text: string,
  sourceLang: string,
  targetLang: string,
): Promise<string> {
  const src = apiChatLang(sourceLang);
  const dst = apiChatLang(targetLang);
  const trimmed = text.trim();
  if (src === dst || !trimmed) return trimmed;
  const cacheKey = `${src}|${dst}|${trimmed}`;
  const cachedOk = translateOkCache.get(cacheKey);
  if (cachedOk) return cachedOk;

  if (!translateRouteMissing) {
    try {
      const res = await api<{ translation?: string }>('/ai/translate', {
        method: 'POST',
        body: JSON.stringify({ text: trimmed, sourceLang: src, targetLang: dst }),
      });
      const out = acceptTranslation(trimmed, res.translation);
      translateOkCache.set(cacheKey, out);
      return out;
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 404 || status === 405) {
        translateRouteMissing = true;
      } else {
        throw err;
      }
    }
  }
  const out = await translateViaLookup(trimmed, src, dst);
  translateOkCache.set(cacheKey, out);
  return out;
}

export async function translateToward(
  text: string,
  sourceLang: string,
  destLang: string,
): Promise<string> {
  const src = normalizeChatLang(sourceLang);
  const dst = normalizeChatLang(destLang);
  if (src === dst) return text;
  const cached = cachedTranslation(text, src, dst);
  if (cached && !sameChatText(cached, text) && !(src === 'RU' && looksLikeLang(cached, src))) {
    return cached;
  }
  const out = await translateChat(text, src, dst);
  if (!out.trim() || sameChatText(out, text)) throw new Error('Translation unchanged');
  // Cyrillic is distinctive; Latin UZ/EN overlap so do not reject those pairs.
  if (src === 'RU' && looksLikeLang(out, src)) throw new Error(`Translation still in ${src}`);
  rememberTranslation(text, src, dst, out);
  return out;
}

export async function composeChatPair(
  text: string,
  nativeLang: string,
  toLang: string,
): Promise<{
  source: string;
  toText: string | null;
  nativeText: string | null;
  sendBody: string;
  sendLang: string;
  sendNative?: string;
}> {
  const to = normalizeChatLang(toLang);
  const native = normalizeChatLang(nativeLang);
  const trimmed = text.trim();
  const source = inferComposerSource(trimmed, native, to);
  let toText: string | null = source === to ? trimmed : null;
  let nativeText: string | null = source === native ? trimmed : null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (!toText) toText = await tryTranslateChat(trimmed, source, to);
    if (!nativeText) {
      nativeText = await tryTranslateChat(trimmed, source, native)
        ?? (toText ? await tryTranslateChat(toText, to, native) : null);
    }
    if (toText && nativeText) break;
  }
  const sendBody = toText ?? trimmed;
  const sendLang = toText ? to : source;
  const sendNative = nativeText && !sameChatText(nativeText, sendBody) ? nativeText : undefined;
  return { source, toText, nativeText, sendBody, sendLang, sendNative };
}

export async function tryTranslateChat(
  text: string,
  sourceLang: string,
  destLang: string,
): Promise<string | null> {
  const src = normalizeChatLang(sourceLang);
  const dst = normalizeChatLang(destLang);
  if (src === dst) return text;
  try {
    return await translateToward(text, src, dst);
  } catch {
    await new Promise((resolve) => setTimeout(resolve, 600));
    try {
      return await translateToward(text, src, dst);
    } catch {
      return null;
    }
  }
}

export type PresentedBubble = {
  primary: string;
  secondary: string;
  primaryLang: string;
  secondaryLang: string;
};

export function presentBubble(args: {
  body: string;
  translation?: string | null;
  bodyLang?: string | null;
  nativeLang: string;
  toLang: string;
  forcedTo?: string | null;
  forcedNative?: string | null;
}): PresentedBubble {
  const native = normalizeChatLang(args.nativeLang);
  const to = normalizeChatLang(args.toLang);
  const body = args.body.trim();
  const stored = args.translation?.trim() ?? '';
  const bodyLang = args.bodyLang
    ? normalizeChatLang(args.bodyLang)
    : (detectChatLang(body) ?? null);
  const forcedTo = args.forcedTo?.trim() ?? '';
  const forcedNative = args.forcedNative?.trim() ?? '';

  const clearlyNative = (text: string) => looksLikeLang(text, native) && !looksLikeLang(text, to);
  const clearlyTo = (text: string) => looksLikeLang(text, to) && !looksLikeLang(text, native);

  // Never put a native-language line in the To slot. Empty primary = still translating.
  const toLine =
    (forcedTo && !clearlyNative(forcedTo) ? forcedTo : '')
    || (body && (clearlyTo(body) || (bodyLang === to && !clearlyNative(body))) ? body : '')
    || (stored && clearlyTo(stored) ? stored : '')
    || (forcedTo && !sameChatText(forcedTo, forcedNative) && !clearlyNative(forcedTo) ? forcedTo : '');

  // `translation` is the native line by contract. Trust it even when Latin detection is unsure.
  const nativeLine =
    (forcedNative && !sameChatText(forcedNative, toLine) ? forcedNative : '')
    || (stored && !sameChatText(stored, toLine) ? stored : '')
    || (body && clearlyNative(body) && !sameChatText(body, toLine) ? body : '');

  return {
    primary: toLine,
    secondary: visibleNativeLine(toLine, nativeLine, to, native),
    primaryLang: to,
    secondaryLang: native,
  };
}

function visibleNativeLine(toLine: string, nativeLine: string, toLang: string, nativeLang: string): string {
  if (!nativeLine.trim()) return '';
  if (!toLine.trim()) return nativeLine;
  if (sameChatText(nativeLine, toLine)) return '';
  if (normalizeChatLang(toLang) === normalizeChatLang(nativeLang)) return '';
  return nativeLine;
}

export function tokenizeChatText(text: string): Array<{ type: 'word' | 'text'; value: string }> {
  const parts: Array<{ type: 'word' | 'text'; value: string }> = [];
  const re = /[\p{L}\p{N}'-]+/gu;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const start = match.index ?? 0;
    if (start > last) parts.push({ type: 'text', value: text.slice(last, start) });
    parts.push({ type: 'word', value: match[0] });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ type: 'text', value: text.slice(last) });
  return parts;
}
