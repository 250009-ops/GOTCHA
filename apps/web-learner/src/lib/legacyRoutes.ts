/**
 * S3a (final-6.1): old learner URLs (pre-final builds, old links, bookmarks) → their real new routes.
 * Paths are router paths (the /learn base is stripped). Unknown paths get the 404 page, never a blank screen.
 */
export const LEGACY_REDIRECTS: Record<string, string> = {
  '/app/profile': '/app/settings',
  '/app/account': '/app/settings',
  '/app/library': '/app',
  '/app/home': '/app',
  '/app/dashboard': '/app',
  '/app/upgrade': '/app/plus',
  '/app/pricing': '/app/plus',
  '/app/premium': '/app/plus',
  '/app/subscription': '/app/plus',
  '/app/billing': '/app/payments',
  '/app/statistics': '/app/stats',
  '/app/progress': '/app/stats',
  '/app/vocab': '/app/vocabulary',
  '/app/words': '/app/vocabulary',
  '/app/review': '/app/practice',
  '/app/imports': '/app/import',
  '/app/chat': '/app/messages',
  '/app/inbox': '/app/messages',
};
const TOP = ['profile', 'account', 'library', 'browse', 'home', 'dashboard', 'upgrade', 'pricing', 'premium', 'subscription', 'plus',
  'billing', 'payments', 'statistics', 'stats', 'progress', 'vocabulary', 'vocab', 'words', 'practice', 'review', 'import', 'imports',
  'messages', 'chat', 'inbox', 'notifications', 'settings'];

/** New route for a legacy path, or null (→ 404 page). Query/hash are kept by the caller. */
export function resolveLegacyPath(pathname: string): string | null {
  const p = ('/' + pathname.replace(/^\/+|\/+$/g, '')).toLowerCase();
  if (LEGACY_REDIRECTS[p]) return LEGACY_REDIRECTS[p];
  const m = /^\/([a-z-]+)$/.exec(p);
  if (m && TOP.includes(m[1])) return resolveLegacyPath('/app/' + m[1]) ?? `/app/${m[1] === 'browse' ? '' : m[1]}`.replace(/\/$/, '');
  return null;
}
