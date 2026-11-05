import { createHmac, timingSafeEqual } from 'crypto';

const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export interface TelegramWebAppUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export type InitDataResult =
  | { ok: true; user: TelegramWebAppUser; authDate: number }
  | { ok: false; reason: 'missing' | 'tampered' | 'expired' };

/**
 * Telegram Mini App initData.
 * secret_key = HMAC_SHA256(key "WebAppData", message bot token).
 * Rejects auth_date older than 24 hours.
 */
export function validateInitData(initData: string | undefined | null, botToken: string, now = Date.now()): InitDataResult {
  if (!initData?.trim() || !botToken) return { ok: false, reason: 'missing' };
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    return { ok: false, reason: 'tampered' };
  }
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]+$/i.test(hash)) return { ok: false, reason: 'tampered' };
  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key === 'hash') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
  const left = Buffer.from(calculated, 'hex');
  const right = Buffer.from(hash, 'hex');
  if (left.length !== right.length || !timingSafeEqual(left, right)) return { ok: false, reason: 'tampered' };
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || authDate <= 0) return { ok: false, reason: 'tampered' };
  if (now - authDate * 1000 > MAX_AGE_MS) return { ok: false, reason: 'expired' };
  let parsed: Partial<TelegramWebAppUser>;
  try {
    parsed = JSON.parse(params.get('user') || '') as Partial<TelegramWebAppUser>;
  } catch {
    return { ok: false, reason: 'tampered' };
  }
  if (!parsed?.id || typeof parsed.id !== 'number') return { ok: false, reason: 'missing' };
  return {
    ok: true,
    authDate,
    user: {
      id: parsed.id,
      first_name: String(parsed.first_name ?? ''),
      last_name: parsed.last_name ? String(parsed.last_name) : undefined,
      username: parsed.username ? String(parsed.username) : undefined,
      language_code: parsed.language_code ? String(parsed.language_code) : undefined,
    },
  };
}

export function telegramFullName(user: { first_name?: string; last_name?: string }): string {
  return [user.first_name, user.last_name].map((part) => (part ?? '').trim()).filter(Boolean).join(' ');
}
