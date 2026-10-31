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
  assertProductionUrlConfig();
}

const LOCAL_HOST = /(^|\/\/)(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)(:\d+)?(\/|$)/i;

/** WLF-09: in production the API must not fall back to localhost CORS origins or a localhost admin URL. */
export function assertProductionUrlConfig(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'production') return;
  const origins = (env.API_CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean);
  if (!origins.length) throw new Error('API_CORS_ORIGINS must be set in production (comma-separated https origins); refusing to start with the localhost default.');
  const badOrigin = origins.find((o) => LOCAL_HOST.test(o));
  if (badOrigin) throw new Error(`API_CORS_ORIGINS must not contain a local origin in production: ${badOrigin}`);
  const admin = env.ADMIN_APP_URL?.trim();
  if (!admin) throw new Error('ADMIN_APP_URL must be set in production; refusing to start with the localhost default.');
  if (LOCAL_HOST.test(admin)) throw new Error(`ADMIN_APP_URL must not be a local URL in production: ${admin}`);
}

/** CORS allowlist: production uses API_CORS_ORIGINS only (assertProductionUrlConfig ran at boot); dev keeps the Vite ports. */
export function corsOriginsFromEnv(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.API_CORS_ORIGINS ?? (env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://localhost:5174,http://localhost:5175');
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
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
