import { pluralEn, pluralRu } from '@gotcha/shared';

/** WLF-05: "{n} pages" in the reader outline, localised (uz has no plural form). */
export function pagesLabel(n: number, locale?: string | null): string {
  if (locale === 'ru') return `${n} ${pluralRu(n, 'страница', 'страницы', 'страниц')}`;
  if (locale === 'uz') return `${n} sahifa`;
  return `${n} ${pluralEn(n, 'page', 'pages')}`;
}
