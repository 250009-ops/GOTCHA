/**
 * final-6.1a: after login/register a learner returns to where they came from (e.g. /app/plus?from=landing-plus).
 * Only same-origin learner app paths are accepted ("/app", "/app/…", or "/learn/app…"; or an absolute URL on
 * the current origin under /learn/app), so returnUrl can never become an open redirect. Returns a router path.
 */
export function safeLearnerReturnPath(raw: unknown, origin: string = typeof window !== 'undefined' ? window.location.origin : 'https://gotchaa.uz'): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.trim();
  if (!s || s.length > 512 || /[\\\u0000-\u001f]/.test(s)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith('//')) {
    try {
      const u = new URL(s);
      if (u.origin !== origin) return null;
      s = u.pathname + u.search + u.hash;
    } catch { return null; }
  }
  if (!s.startsWith('/') || s.startsWith('//')) return null;
  let u: URL;
  try { u = new URL(s, 'https://x.invalid'); } catch { return null; }
  if (u.origin !== 'https://x.invalid') return null;
  let path = u.pathname.replace(/^\/learn(?=\/app(?:\/|$))/, '');
  if (!/^\/app(?:\/[A-Za-z0-9._~%-]+)*\/?$/.test(path) || path.split('/').some((seg) => seg === '..' || seg === '.')) return null;
  u.searchParams.delete('returnUrl');
  const q = u.searchParams.toString();
  return path + (q ? `?${q}` : '') + u.hash;
}
