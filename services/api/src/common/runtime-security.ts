import type { IncomingMessage } from 'http';

export function isProductionRuntime() {
  return process.env.NODE_ENV === 'production';
}

export function jwtSecretOrThrow(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (isProductionRuntime()) {
    if (!secret || secret.length < 32 || secret === 'dev-secret-change-me') {
      throw new Error('JWT_SECRET must be set to a strong 32+ character value in production.');
    }
    return secret;
  }
  if (!secret) {
    console.warn('JWT_SECRET is unset — using an insecure development fallback.');
    return 'dev-secret-change-me';
  }
  return secret;
}

export function assertProductionAuthConfig() {
  if (!isProductionRuntime()) return;
  if (process.env.DEV_AUTH_ANY_CREDENTIAL === 'true') {
    throw new Error('DEV_AUTH_ANY_CREDENTIAL must be false in production.');
  }
  jwtSecretOrThrow();
}

export function clientIp(req: {
  headers?: IncomingMessage['headers'];
  ip?: string;
  socket?: { remoteAddress?: string | null };
}): string {
  const realIp = req.headers?.['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  if (req.ip) return req.ip;
  return req.socket?.remoteAddress || 'unknown';
}

export function applySecurityHeaders(res: { setHeader(name: string, value: string): void }) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (isProductionRuntime()) {
    res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
  }
}
