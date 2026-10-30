const LEARNER_APP_URL = (
  import.meta.env.VITE_LEARNER_APP_URL ?? 'http://localhost:5175'
).replace(/\/$/, '');

/** Admin app base for login returnUrl (path-aware on single-host deploys). */
export function adminReturnUrl() {
  const fromEnv = import.meta.env.VITE_ADMIN_APP_URL?.trim()?.split(',')?.[0]?.trim();
  if (fromEnv) return fromEnv.replace(/\/?$/, '/');
  const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
  return `${window.location.origin}${base === '/' ? '/' : base}`;
}

function withReturnUrl(path: string, returnUrl: string) {
  const url = new URL(path, LEARNER_APP_URL);
  url.searchParams.set('returnUrl', returnUrl);
  return url.toString();
}

export function learnerLoginUrl() {
  return withReturnUrl('/login', adminReturnUrl());
}

export function learnerForgotPasswordUrl() {
  return withReturnUrl('/forgot-password', adminReturnUrl());
}

export function learnerVerifyEmailUrl(email?: string) {
  const url = new URL('/verify-email', LEARNER_APP_URL);
  url.searchParams.set('returnUrl', adminReturnUrl());
  if (email?.trim()) url.searchParams.set('email', email.trim());
  return url.toString();
}
