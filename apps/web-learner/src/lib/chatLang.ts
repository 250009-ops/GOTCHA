import { api } from './api';
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
  'salom', 'rahmat', 'yaxshi', 'qanday', 'nima', 'qayerda', 'bugun', 'kecha',
  'kitob', 'dost', "do'st", 'ha', 'yoq', "yo'q", 'men', 'sen', 'biz', 'ular',
  'kerak', 'mumkin', 'iltimos', 'kechirasiz',
]);

const EN_HINTS = new Set([
  'the', 'is', 'are', 'you', 'hello', 'hi', 'hey', 'thanks', 'and', 'this', 'that', 'have',
  'what', 'how', 'with', 'from', 'your', 'just',
]);

const LOOKUP_TOKEN_MAX = 80;
const LOOKUP_SENTENCE_MAX = 500;

const translationCache = new Map<string, string>();
let translateRouteMissing = false;

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

export function detectChatLang(text: string): string | null {
  const letters = [...text].filter((ch) => /\p{L}/u.test(ch));
  if (letters.length === 0) return null;
  const allowed = new Set(enabledChatLangs);
  const pick = (code: string) => (allowed.has(code) ? code : null);

  if (letters.some((ch) => ch >= '\u3040' && ch <= '\u30FF')) return pick('JA') ?? pick('EN');
  if (letters.some((ch) => ch >= '\uAC00' && ch <= '\uD7AF')) return pick('KO') ?? pick('EN');
  const cyr = letters.filter((ch) => ch >= '\u0400' && ch <= '\u04FF').length;
  if (cyr * 4 >= letters.length) return pick('RU') ?? pick('UZ') ?? pick('EN');
  const lower = text.toLowerCase();
  if (/[ʻʼ‘’']|o'|g'|oʻ|gʻ/.test(lower)) return pick('UZ') ?? pick('EN');
  const tokens = [...lower.matchAll(/[\p{L}']+/gu)].map((m) => m[0]);
  const score = (hints: Set<string>) => tokens.filter((t) => hints.has(t)).length;
  const ranked: Array<[string, number]> = [
    ['UZ', score(UZ_HINTS)],
    ['FR', score(FR_HINTS)],
    ['ES', score(ES_HINTS)],
    ['DE', score(DE_HINTS)],
    ['PT', score(PT_HINTS)],
    ['EN', score(EN_HINTS)],
  ];
  ranked.sort((a, b) => b[1] - a[1]);
  const best = ranked.find(([code, hits]) => hits > 0 && allowed.has(code));
  if (best) return best[0];
  return pick('EN') ?? enabledChatLangs[0] ?? 'EN';
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
  return want === 'RU' ? got === 'RU' : got !== 'RU';
}

const CHAT_META: Record<string, { name: string; flag: string }> = {
  EN: { name: 'English', flag: '🇬🇧' },
  RU: { name: 'Russian', flag: '🇷🇺' },
  UZ: { name: 'Uzbek', flag: '🇺🇿' },
  FR: { name: 'French', flag: '🇫🇷' },
  ES: { name: 'Spanish', flag: '🇪🇸' },
  JA: { name: 'Japanese', flag: '🇯🇵' },
  DE: { name: 'German', flag: '🇩🇪' },
  KO: { name: 'Korean', flag: '🇰🇷' },
  PT: { name: 'Portuguese', flag: '🇵🇹' },
};

export function chatLangName(code: string): string {
  const key = normalizeChatLang(code);
  return CHAT_META[key]?.name ?? key;
}

export function chatLangFlag(code: string): string {
  const key = normalizeChatLang(code);
  return CHAT_META[key]?.flag ?? '🌐';
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

  if (!translateRouteMissing) {
    try {
      const res = await api<{ translation?: string }>('/ai/translate', {
        method: 'POST',
        body: JSON.stringify({ text: trimmed, sourceLang: src, targetLang: dst }),
      });
      return acceptTranslation(trimmed, res.translation);
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 404 || status === 405) {
        translateRouteMissing = true;
      } else {
        throw err;
      }
    }
  }
  return translateViaLookup(trimmed, src, dst);
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
  if (cached && !sameChatText(cached, text) && looksLikeLang(cached, dst)) return cached;
  const out = await translateChat(text, src, dst);
  if (!out.trim() || sameChatText(out, text)) throw new Error('Translation unchanged');
  if (!looksLikeLang(out, dst)) throw new Error(`Translation not in ${dst}`);
  rememberTranslation(text, src, dst, out);
  return out;
}

export async function tryTranslateChat(
  text: string,
  sourceLang: string,
  destLang: string,
): Promise<string | null> {
  const src = normalizeChatLang(sourceLang);
  const dst = normalizeChatLang(destLang);
  if (src === dst) return text;
  for (let i = 0; i < 2; i += 1) {
    try {
      return await translateToward(text, src, dst);
    } catch {
      // retry once, then give up
    }
  }
  return null;
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
  nativeLang: string;
  toLang: string;
  forcedTo?: string | null;
  forcedNative?: string | null;
}): PresentedBubble {
  const native = normalizeChatLang(args.nativeLang);
  const to = normalizeChatLang(args.toLang);
  const pickTo = (...candidates: Array<string | null | undefined>) =>
    candidates.find((candidate) => {
      const t = candidate?.trim() ?? '';
      return t && looksLikeLang(t, to);
    })?.trim() ?? '';

  const toLine = pickTo(args.forcedTo, args.body, args.translation);
  const nativeLine =
    [
      args.forcedNative?.trim(),
      looksLikeLang(args.body, native) ? args.body : null,
      args.translation && looksLikeLang(args.translation, native) ? args.translation : null,
      args.translation && looksLikeLang(args.body, to) ? args.translation : null,
    ].find((item) => item?.trim()) ?? '';

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
