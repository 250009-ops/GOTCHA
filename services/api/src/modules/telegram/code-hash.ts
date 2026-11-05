import { createHash, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export const CODE_TTL_MS = 5 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

export function codePepper(): string {
  return process.env.TELEGRAM_CODE_PEPPER?.trim() || process.env.JWT_SECRET?.trim() || 'gotcha-telegram-code';
}

export function hashLoginCode(code: string, challengeId: string, pepper = codePepper()): string {
  return createHash('sha256').update(`${pepper}:${challengeId}:${code}`).digest('hex');
}

export function codeMatches(code: string, challengeId: string, codeHash: string | null): boolean {
  if (!codeHash) return false;
  const next = hashLoginCode(code, challengeId);
  const left = Buffer.from(next, 'hex');
  const right = Buffer.from(codeHash, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export function randomLoginCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** 32 random bytes, base64url, so login_<token> stays inside Telegram's 64-character start payload. */
export function randomLinkToken(): string {
  return randomBytes(32).toString('base64url');
}
