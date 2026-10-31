/** Marketing / landing site (`apps/web`). */
export const MARKETING_URL = (
  import.meta.env.VITE_WEB_URL ??
  import.meta.env.VITE_MARKETING_URL ??
  (import.meta.env.DEV ? 'http://localhost:5174' : '')
).replace(/\/$/, '');

/** Learner app base (this app). */
export const LEARNER_APP_URL = (
  import.meta.env.VITE_LEARNER_APP_URL ?? (import.meta.env.DEV ? 'http://localhost:5175' : '')
).replace(/\/$/, '');

/**
 * Allowed admin console base URLs for post-login hash handoff.
 * Comma-separated `VITE_ADMIN_APP_URL` overrides the localhost defaults.
 * Entries may be origins (`http://localhost:5173`) or path bases
 * (`https://gotchaa.uz/admin`) for single-host path deploys.
 */
export const ADMIN_APP_BASES = (
  import.meta.env.VITE_ADMIN_APP_URL ??
  (import.meta.env.DEV ? 'http://localhost:5173,http://localhost:5174' : '')
)
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

/** Default admin console URL for post-login handoff (path-aware in production). */
export function adminAppUrl(): string {
  const fromEnv = ADMIN_APP_BASES[0];
  if (fromEnv) {
    return fromEnv.endsWith('/') ? fromEnv : `${fromEnv}/`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/admin/`;
  }
  return import.meta.env.DEV ? 'http://localhost:5173/' : '/admin/';
}

/**
 * Validate `returnUrl` from the admin app.
 * Accepts same-origin path bases (production `/admin`) and distinct origins (local ports).
 * In DEV, also allow any localhost / 127.0.0.1 origin that isn't the learner app
 * (Vite may bump the admin port when 5173 is taken).
 */
export function isAllowedAdminReturnUrl(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const origin = url.origin.replace(/\/$/, '');
    const path = `${url.pathname || '/'}${url.search}`;
    const hrefNoHash = `${origin}${path}`;

    for (const base of ADMIN_APP_BASES) {
      // Exact origin allow-list (local multi-port), or path-prefix under a shared origin.
      if (origin === base || hrefNoHash === base || hrefNoHash.startsWith(`${base}/`)) {
        return hrefNoHash;
      }
    }

    // Single-host deploys: allow same-origin /admin even if env allow-list is stale.
    if (typeof window !== 'undefined' && origin === window.location.origin) {
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        return hrefNoHash;
      }
    }

    if (import.meta.env.DEV) {
      const host = url.hostname;
      if (host === 'localhost' || host === '127.0.0.1') {
        const learnerOrigin = new URL(LEARNER_APP_URL).origin;
        if (origin !== learnerOrigin) {
          return hrefNoHash;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
