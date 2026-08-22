/** Paths that must not bootstrap a learner session. */
export const PUBLIC_AUTH_PATHS = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
] as const;

/**
 * React Router pathname with basename stripped, plus a fallback if `/learn`
 * ever leaks into `useLocation().pathname` (trailing slashes included).
 */
export function learnerRoutePath(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  if (trimmed === '/learn' || trimmed.startsWith('/learn/')) {
    return trimmed.slice('/learn'.length) || '/';
  }
  return trimmed;
}

export function isPublicAuthPath(pathname: string): boolean {
  return (PUBLIC_AUTH_PATHS as readonly string[]).includes(learnerRoutePath(pathname));
}

/** Absolute path inside this SPA, including Vite `BASE_URL` (`/learn` in production). */
export function withAppBase(path: string): string {
  const base = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!base) return normalized;
  return `${base}${normalized}`;
}

/** Query string to keep when toggling login ↔ register. `plan`/`lang` are signup-only. */
export function authSwitchSearch(
  params: URLSearchParams,
  goingTo: 'login' | 'register',
): string {
  const next = new URLSearchParams();
  const from = params.get('from');
  const returnUrl = params.get('returnUrl');
  if (from) next.set('from', from);
  if (returnUrl) next.set('returnUrl', returnUrl);
  if (goingTo === 'register') {
    const plan = params.get('plan');
    const lang = params.get('lang');
    if (plan) next.set('plan', plan);
    if (lang) next.set('lang', lang);
  }
  return next.toString();
}

/** Preserve returnUrl (and optional extra params) across auth sub-pages. */
export function authFlowSearch(
  params: URLSearchParams,
  extra?: Record<string, string | undefined>,
): string {
  const next = new URLSearchParams();
  const returnUrl = params.get('returnUrl');
  if (returnUrl) next.set('returnUrl', returnUrl);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) next.set(key, value);
    }
  }
  return next.toString();
}

/** Login path with optional returnUrl preserved from current search params. */
export function loginPathWithReturn(params: URLSearchParams): string {
  const q = authFlowSearch(params);
  return q ? `/login?${q}` : '/login';
}
