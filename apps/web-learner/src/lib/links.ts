/** Marketing / landing site (`apps/web`). */
export const MARKETING_URL = (
  import.meta.env.VITE_WEB_URL ??
  import.meta.env.VITE_MARKETING_URL ??
  'http://localhost:5174'
).replace(/\/$/, '');

/** Learner app origin (this app). */
export const LEARNER_APP_URL = (
  import.meta.env.VITE_LEARNER_APP_URL ?? 'http://localhost:5175'
).replace(/\/$/, '');

/**
 * Allowed admin console origins for post-login hash handoff.
 * Comma-separated `VITE_ADMIN_APP_URL` overrides the localhost defaults.
 */
export const ADMIN_APP_ORIGINS = (
  import.meta.env.VITE_ADMIN_APP_URL ??
  'http://localhost:5173,http://localhost:5174'
)
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

/**
 * Validate `returnUrl` from the admin app.
 * In DEV, also allow any localhost / 127.0.0.1 origin that isn't the learner app
 * (Vite may bump the admin port when 5173 is taken).
 */
export function isAllowedAdminReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const origin = url.origin.replace(/\/$/, '');
    const path = `${url.pathname || '/'}${url.search}`;

    if (ADMIN_APP_ORIGINS.includes(origin)) {
      return `${origin}${path}`;
    }

    if (import.meta.env.DEV) {
      const host = url.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        const learnerOrigin = new URL(LEARNER_APP_URL).origin;
        if (origin !== learnerOrigin) {
          return `${origin}${path}`;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
