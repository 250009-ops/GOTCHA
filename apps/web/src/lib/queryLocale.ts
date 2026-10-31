// final-6.1 (QA live pass 1, S3c): the landing language comes from ?lang= or ?ui= (lang wins), en/ru/uz only.
export const QUERY_LOCALES = ['en', 'ru', 'uz'] as const;
export type QueryLocale = (typeof QUERY_LOCALES)[number];
export function localeFromQuery(params?: URLSearchParams | null): QueryLocale | null {
  for (const key of ['lang', 'ui']) {
    const v = params?.get(key)?.trim().toLowerCase();
    if (v && (QUERY_LOCALES as readonly string[]).includes(v)) return v as QueryLocale;
  }
  return null;
}
/** Query after a language pick: lang= and ui= both carry the new locale so links and reloads agree. */
export function queryWithLocale(params: URLSearchParams, code: QueryLocale): URLSearchParams {
  const p = new URLSearchParams(params);
  p.set('lang', code);
  if (p.has('ui')) p.set('ui', code);
  return p;
}
/** Footer build id: short sha + build date (YYYY-MM-DD). */
export function buildId(commit?: string, date?: string): string {
  return [commit, date].filter(Boolean).join(' · ');
}
