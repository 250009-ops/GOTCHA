const LOCAL_OR_LAN_ORIGIN =
  /^https?:\/\/(?:10\.0\.2\.2|127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3})(?::\d+)?/i;

function productionOrigin() {
  const api = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'https://gotchaa.uz/api/v1';
  const cut = api.indexOf('/api/');
  let origin = (cut > 0 ? api.slice(0, cut) : api.replace(/\/$/, '')) || 'https://gotchaa.uz';
  if (origin.startsWith('http://')) origin = `https://${origin.slice(7)}`;
  return origin.replace(/\/$/, '');
}

/** Same rewrite rules as Android `resolveMediaUrl` — relative keys and leftover localhost hosts. */
export function resolveMediaUrl(raw?: string | null): string | null {
  const value = raw?.trim();
  if (!value) return null;
  const origin = productionOrigin();
  const rewritten = value.replace(LOCAL_OR_LAN_ORIGIN, origin);
  if (/^https:\/\//i.test(rewritten)) return rewritten;
  if (/^http:\/\//i.test(rewritten)) return `https://${rewritten.slice(7)}`;
  if (rewritten.startsWith('/')) return `${origin}${rewritten}`;
  return `${origin}/${rewritten}`;
}
