import { createHmac, timingSafeEqual } from 'node:crypto';

function avatarKey() {
  const key = process.env.AVATAR_URL_SECRET || process.env.JWT_SECRET;
  if (key && key.length >= 16) return key;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AVATAR_URL_SECRET or JWT_SECRET is required to sign avatar URLs');
  }
  return 'dev-avatar-url-secret';
}

/** Short-lived URL an <img> can load without a Bearer header. Exp is bucketed so caches can reuse it. */
export function signAvatar(file: string, ttl = 3600) {
  const exp = Math.floor(Date.now() / 1000 / 600) * 600 + ttl;
  const sig = createHmac('sha256', avatarKey()).update(`${file}.${exp}`).digest('base64url');
  return `/api/v1/users/avatars/${file}?exp=${exp}&sig=${sig}`;
}

export function verifyAvatar(file: string, exp: string, sig: string) {
  if (!/^\d+$/.test(exp) || !sig) return false;
  if (Number(exp) <= Date.now() / 1000) return false;
  const expected = createHmac('sha256', avatarKey()).update(`${file}.${exp}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
