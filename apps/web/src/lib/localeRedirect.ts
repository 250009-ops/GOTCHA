/** Keep only the locale params (?lang, ?ui) when the app redirects, so the visitor's language survives. */
export function withLocaleQuery(path: string, search: string): string {
  const from = new URLSearchParams(search);
  const next = new URLSearchParams();
  for (const k of ['lang', 'ui']) {
    const v = from.get(k);
    if (v) next.set(k, v);
  }
  const q = next.toString();
  return q ? `${path}?${q}` : path;
}
