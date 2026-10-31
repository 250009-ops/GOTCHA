/** Web-learner app base URL (Sign in / Get started). */
const ENV: Record<string, string | undefined> = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
// Vite folds `import.meta.env.DEV` to false in production, so the localhost dev default never reaches dist
// (bundle gate tools/check-dist-hosts.mjs). Node tests have no import.meta.env, hence `?.` (true there).
const IS_DEV: boolean = import.meta.env?.DEV ?? true;
export const LEARNER_APP_URL = (ENV.VITE_LEARNER_APP_URL ?? (IS_DEV ? 'http://localhost:5175' : '/learn')).replace(/\/$/, '');

/** WL1-04: every /learn CTA carries the landing page's UI language as `ui` (uz | ru | en). */
export type UiLocale = 'uz' | 'ru' | 'en' | (string & {});

/**
 * Join an app base URL with a path. Do not use `new URL('/login', base)` —
 * an absolute path replaces the base pathname (breaks path-based `/learn`).
 */
function learnerPath(path: string) {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return new URL(`${LEARNER_APP_URL}${normalized}`);
}

export type PlanTier = 'free' | 'pay-per-import';

export function loginUrl(opts?: { from?: string; ui?: UiLocale }) {
  const url = learnerPath('/login');
  url.searchParams.set('from', opts?.from ?? 'landing');
  if (opts?.ui) url.searchParams.set('ui', opts.ui);
  return url.toString();
}

/** `lang` is the language to LEARN (only when the visitor picked one); `ui` is the page language. */
export function registerUrl(opts?: { plan?: PlanTier; from?: string; lang?: string; ui?: UiLocale }) {
  const url = learnerPath('/register');
  url.searchParams.set('from', opts?.from ?? 'landing');
  if (opts?.plan) url.searchParams.set('plan', opts.plan);
  if (opts?.lang) url.searchParams.set('lang', opts.lang);
  if (opts?.ui) url.searchParams.set('ui', opts.ui);
  return url.toString();
}

export function libraryUrl(opts?: { ui?: UiLocale }) {
  const url = learnerPath('/');
  if (opts?.ui) url.searchParams.set('ui', opts.ui);
  return url.toString();
}

/** WLF-34: the learner's Plus page (checkout lives there). /app/* is behind ProtectedRoute, so logged-out visitors go to /learn/login first. */
export function plusUrl(opts?: { from?: string; ui?: UiLocale; days?: 30 | 365 }) {
  const url = learnerPath('/app/plus');
  url.searchParams.set('from', opts?.from ?? 'landing-plus');
  if (opts?.ui) url.searchParams.set('ui', opts.ui);
  if (opts?.days) url.searchParams.set('days', String(opts.days));
  return url.toString();
}
