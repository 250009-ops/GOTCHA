import { useEffect } from 'react';

export const SITE_ORIGIN = (
  import.meta.env.VITE_MARKETING_URL ||
  import.meta.env.VITE_WEB_URL ||
  'https://gotchaa.uz'
).replace(/\/$/, '');

export const SITE_NAME = 'GOTCHA';
export const DEFAULT_TITLE = "GOTCHA — Tap the word you don't know. Gotcha explains it in that sentence.";
export const DEFAULT_DESCRIPTION =
  'Turn any text into a lesson. Tap words for AI definitions, save vocabulary with spaced repetition. English, Russian, and Uzbek.';

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, value);
  }
}

const OG_LOCALE = { uz: 'uz_UZ', ru: 'ru_RU', en: 'en_US' } as const;
export type SeoLang = keyof typeof OG_LOCALE;

function upsertAlternate(hreflang: string, href: string) {
  let el = document.head.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', hreflang);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

export function Seo({
  title,
  description,
  path = '/',
  noindex = false,
  lang,
}: {
  title: string;
  description: string;
  path?: string;
  noindex?: boolean;
  /** Page language: per-language canonical (?lang=xx), hreflang uz/ru/en/x-default and og:locale (QA LP1-02). */
  lang?: SeoLang;
}) {
  useEffect(() => {
    const base = `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
    const canonical = lang ? `${base}?lang=${lang}` : base;
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} — ${SITE_NAME}`;
    document.title = fullTitle;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex ? 'noindex, nofollow' : 'index, follow',
    });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: fullTitle });
    upsertLink('canonical', canonical);
    if (lang) {
      document.documentElement.lang = lang;
      upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: OG_LOCALE[lang] });
      for (const l of Object.keys(OG_LOCALE)) upsertAlternate(l, `${base}?lang=${l}`);
      upsertAlternate('x-default', base);
    }
  }, [title, description, path, noindex, lang]);

  return null;
}
