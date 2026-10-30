import { APP_LANGUAGES, type AppLanguage } from '@gotcha/shared';

export type WebLocale = AppLanguage;

export const WEB_LOCALE_STORAGE = 'gotcha.web.locale';

/** Full landing-page copy exists for these locales; others use English until translated. */
export const MARKETING_LOCALES = ['en', 'ru', 'uz'] as const;
export type MarketingLocale = (typeof MARKETING_LOCALES)[number];

const REGION_HINTS: Record<string, WebLocale> = {
  uz: 'uz',
  ru: 'ru',
  by: 'ru',
  kz: 'ru',
  kg: 'ru',
  tj: 'ru',
  am: 'ru',
  md: 'ru',
  ua: 'uk',
  de: 'de',
  fr: 'fr',
  es: 'es',
  tr: 'tr',
  ko: 'ko',
  ja: 'ja',
  ar: 'ar',
  zh: 'zh',
  hi: 'hi',
  pt: 'pt',
  it: 'it',
  pl: 'pl',
  nl: 'nl',
  sv: 'sv',
  vi: 'vi',
  th: 'th',
  id: 'id',
};

export function isWebLocale(code?: string | null): code is WebLocale {
  return !!code && (APP_LANGUAGES as readonly string[]).includes(code.trim().toLowerCase());
}

export function marketingLocaleFor(detected: WebLocale): MarketingLocale {
  if (detected === 'ru') return 'ru';
  if (detected === 'en') return 'en';
  return 'uz';
}

/** gotcha.uz / gotchaa.uz and other Uzbekistan domains default to Uzbek. */
export function domainDefaultLocale(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): WebLocale | null {
  const host = hostname.trim().toLowerCase();
  if (!host) return null;
  if (
    host === 'gotcha.uz' ||
    host === 'www.gotcha.uz' ||
    host.endsWith('.gotcha.uz') ||
    host === 'gotchaa.uz' ||
    host === 'www.gotchaa.uz' ||
    host.endsWith('.gotchaa.uz')
  ) {
    return 'uz';
  }
  if (host.endsWith('.uz')) return 'uz';
  if (host.endsWith('.ru') || host.includes('gotcha.ru')) return 'ru';
  return null;
}

export function resolveWebLocale(candidates?: (string | null | undefined)[]): WebLocale {
  for (const raw of candidates ?? []) {
    if (!raw?.trim()) continue;
    const tag = raw.trim().toLowerCase().replace(/_/g, '-');
    if (isWebLocale(tag)) return tag;
    const primary = tag.split('-')[0] ?? '';
    if (isWebLocale(primary)) return primary;
    const region = tag.split('-')[1] ?? '';
    const hinted = REGION_HINTS[region];
    if (hinted) return hinted;
  }
  return 'uz';
}

/** Browser hint only for Russian/Uzbek — fresh visitors default to Uzbek, not English from browser. */
function browserRuUzHint(): WebLocale | null {
  if (typeof navigator === 'undefined') return null;
  for (const raw of [...(navigator.languages ?? []), navigator.language]) {
    if (!raw?.trim()) continue;
    const tag = raw.trim().toLowerCase().replace(/_/g, '-');
    const primary = tag.split('-')[0] ?? '';
    if (primary === 'ru' || tag.includes('-ru')) return 'ru';
    if (primary === 'uz' || tag.includes('-uz')) return 'uz';
  }
  return null;
}

/** Detect locale: explicit ?lang= → saved choice → domain → RU/UZ browser hint → Uzbek default. */
export function detectWebLocale(searchParams?: URLSearchParams): WebLocale {
  const fromQuery = searchParams?.get('lang')?.trim().toLowerCase();
  if (fromQuery && isWebLocale(fromQuery)) return fromQuery;

  try {
    const stored = localStorage.getItem(WEB_LOCALE_STORAGE);
    if (stored && isWebLocale(stored)) return stored;
  } catch {
    /* ignore */
  }

  const fromDomain = domainDefaultLocale();
  if (fromDomain) return fromDomain;

  const fromBrowser = browserRuUzHint();
  if (fromBrowser) return fromBrowser;

  return 'uz';
}

export function persistWebLocale(code: WebLocale) {
  try {
    localStorage.setItem(WEB_LOCALE_STORAGE, code);
  } catch {
    /* ignore */
  }
}
