/** Auth deep links opened by the native GOTCHA Android app (`gotcha://`). */
export type GotchaAuthPath = 'verify-email' | 'reset-password';

export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Android/i.test(navigator.userAgent)) return true;
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('client') === 'android') return true;
  }
  return false;
}

export function buildGotchaAuthDeepLink(
  path: GotchaAuthPath,
  token: string,
  searchParams?: URLSearchParams,
): string {
  const params = new URLSearchParams();
  params.set('token', token);
  const returnUrl = searchParams?.get('returnUrl')?.trim();
  if (returnUrl) params.set('returnUrl', returnUrl);
  return `gotcha://${path}?${params.toString()}`;
}

/** Navigate to the native app. Returns true when a redirect was attempted. */
export function tryOpenGotchaAuthApp(
  path: GotchaAuthPath,
  token: string,
  searchParams?: URLSearchParams,
): boolean {
  if (!isAndroidDevice() || !token.trim()) return false;
  window.location.href = buildGotchaAuthDeepLink(path, token.trim(), searchParams);
  return true;
}
