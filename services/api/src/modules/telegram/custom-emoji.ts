import { Logger } from '@nestjs/common';

/**
 * Premium custom emoji for @gotchaa_app (the bot owns this Fragment username).
 *
 * TELEGRAM_CUSTOM_EMOJI_IDS is a JSON object of string ids:
 * {"wave":"123","book":"456","tap":"789","brain":"111","fire":"222","key":"333","check":"444"}
 * When the variable is unset, or a slot is missing, that slot stays the plain fallback emoji
 * and the message is sent as HTML, the same way as a normal emoji.
 */
export const CUSTOM_EMOJI_FALLBACK = {
  wave: '👋',
  book: '📚',
  tap: '👆',
  brain: '🧠',
  fire: '🔥',
  key: '🔑',
  check: '✅',
} as const;

export type CustomEmojiKey = keyof typeof CUSTOM_EMOJI_FALLBACK;

export const WELCOME_EMOJI_KEYS = ['wave', 'book', 'tap'] as const satisfies readonly CustomEmojiKey[];
export const CODE_EMOJI_KEYS = ['key'] as const satisfies readonly CustomEmojiKey[];

/** Which slot each notification uses. New-message alerts share the wave sticker. */
export const NOTIFICATION_EMOJI_KEY = {
  content: 'book',
  goal: 'check',
  vocab: 'brain',
  message: 'wave',
  streak: 'fire',
} as const satisfies Record<string, CustomEmojiKey>;

export type BotEntity =
  | { type: 'bold'; offset: number; length: number }
  | { type: 'custom_emoji'; offset: number; length: number; custom_emoji_id: string };

const ID_PATTERN = /^\d{1,32}$/;

export function notificationEmojiKeys(kind: string): CustomEmojiKey[] {
  const slot = NOTIFICATION_EMOJI_KEY[kind as keyof typeof NOTIFICATION_EMOJI_KEY];
  return slot ? [slot] : [];
}

export function readCustomEmojiIds(env: NodeJS.ProcessEnv = process.env): Partial<Record<CustomEmojiKey, string>> {
  const raw = env.TELEGRAM_CUSTOM_EMOJI_IDS?.trim();
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const ids: Partial<Record<CustomEmojiKey, string>> = {};
  for (const key of Object.keys(CUSTOM_EMOJI_FALLBACK) as CustomEmojiKey[]) {
    const value = (parsed as Record<string, unknown>)[key];
    if (typeof value === 'string' && ID_PATTERN.test(value.trim())) ids[key] = value.trim();
  }
  return ids;
}

/**
 * HTML in, Telegram payload out.
 * With no matching ids, `text` is the HTML and `entities` is omitted.
 * With ids, `text` is plain and `entities` carries bold plus custom_emoji.
 * parse_mode and entities are never used together.
 */
export function applyCustomEmoji(html: string, keys: readonly CustomEmojiKey[]): { text: string; entities?: BotEntity[] } {
  const ids = readCustomEmojiIds();
  const seen = new Set<CustomEmojiKey>();
  const hits = keys.filter((key) => {
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(ids[key]) && html.includes(CUSTOM_EMOJI_FALLBACK[key]);
  });
  if (!hits.length) return { text: html };

  const rendered = htmlToBoldEntities(html);
  for (const key of hits) {
    const emoji = CUSTOM_EMOJI_FALLBACK[key];
    const offset = rendered.text.indexOf(emoji);
    if (offset < 0) continue;
    const id = ids[key];
    if (!id) continue;
    rendered.entities.push({ type: 'custom_emoji', offset, length: emoji.length, custom_emoji_id: id });
  }
  rendered.entities.sort((a, b) => a.offset - b.offset || a.length - b.length);
  return rendered.entities.length ? { text: rendered.text, entities: rendered.entities } : { text: html };
}

function htmlToBoldEntities(html: string): { text: string; entities: BotEntity[] } {
  let text = '';
  const entities: BotEntity[] = [];
  const stack: number[] = [];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<b>', i)) {
      stack.push(text.length);
      i += 3;
      continue;
    }
    if (html.startsWith('</b>', i)) {
      const start = stack.pop();
      if (start !== undefined && text.length > start) {
        entities.push({ type: 'bold', offset: start, length: text.length - start });
      }
      i += 4;
      continue;
    }
    if (html.startsWith('&amp;', i)) {
      text += '&';
      i += 5;
      continue;
    }
    if (html.startsWith('&lt;', i)) {
      text += '<';
      i += 4;
      continue;
    }
    if (html.startsWith('&gt;', i)) {
      text += '>';
      i += 4;
      continue;
    }
    text += html[i];
    i += 1;
  }
  return { text, entities };
}

function isProduction(): boolean {
  return (process.env.NODE_ENV ?? '').trim().toLowerCase() === 'production';
}

/** Numeric custom_emoji_id values anywhere in an incoming update. Message text is ignored. */
export function incomingCustomEmojiIds(update: unknown): string[] {
  const ids: string[] = [];
  walk(update, 0, ids, new Set<string>(), new WeakSet<object>());
  return ids;
}

function walk(value: unknown, depth: number, ids: string[], seenIds: Set<string>, seenObjects: WeakSet<object>) {
  if (depth > 8 || !value || typeof value !== 'object') return;
  if (seenObjects.has(value)) return;
  seenObjects.add(value);
  if (Array.isArray(value)) {
    for (const item of value) walk(item, depth + 1, ids, seenIds, seenObjects);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'custom_emoji_id' && typeof child === 'string' && ID_PATTERN.test(child) && !seenIds.has(child)) {
      seenIds.add(child);
      ids.push(child);
    } else {
      walk(child, depth + 1, ids, seenIds, seenObjects);
    }
  }
}

/**
 * Logs ids while a Premium emoji is forwarded to the bot in development.
 * Returns immediately in production, before the update is inspected.
 */
export function logIncomingCustomEmoji(update: unknown, write?: (line: string) => void): void {
  if (isProduction()) return;
  const ids = incomingCustomEmojiIds(update);
  if (!ids.length) return;
  const emit = write ?? ((line: string) => new Logger('Telegram').log(line));
  for (const id of ids) emit(`custom_emoji_id ${id}`);
}
