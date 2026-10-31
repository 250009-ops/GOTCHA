import { UI_LANGUAGES, type UiLanguage } from '@gotcha/shared';

export const LEARNER_LOCALE_STORAGE = 'gotcha.learner.locale';

/** Reuse marketing locale key so language choice persists across site ↔ learner app. */
export const SHARED_LOCALE_STORAGE = 'gotcha.web.locale';

export function isUiLanguage(code?: string | null): code is UiLanguage {
  return !!code && (UI_LANGUAGES as readonly string[]).includes(code.trim().toLowerCase());
}

const REGION_HINTS: Record<string, UiLanguage> = {
  uz: 'uz',
  ru: 'ru',
  by: 'ru',
  kz: 'ru',
  kg: 'ru',
  tj: 'ru',
  am: 'ru',
  md: 'ru',
};

export function domainDefaultLocale(hostname = typeof window !== 'undefined' ? window.location.hostname : ''): UiLanguage | null {
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

export function resolveUiLocale(candidates?: (string | null | undefined)[]): UiLanguage {
  for (const raw of candidates ?? []) {
    if (!raw?.trim()) continue;
    const tag = raw.trim().toLowerCase().replace(/_/g, '-');
    if (isUiLanguage(tag)) return tag;
    const primary = tag.split('-')[0] ?? '';
    if (isUiLanguage(primary)) return primary;
    const region = tag.split('-')[1] ?? '';
    const hinted = REGION_HINTS[region];
    if (hinted) return hinted;
  }
  return 'uz';
}

/** Browser hint only for Russian/Uzbek — fresh visitors default to Uzbek, not English from browser. */
function browserRuUzHint(): UiLanguage | null {
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

/** Detect UI locale: ?lang= → learner saved → domain → shared marketing saved → RU/UZ browser → Uzbek. */
export function detectLearnerLocale(searchParams?: URLSearchParams): UiLanguage {
  const fromQuery = searchParams?.get('lang')?.trim().toLowerCase();
  if (fromQuery && isUiLanguage(fromQuery)) return fromQuery;

  try {
    const learnerStored = localStorage.getItem(LEARNER_LOCALE_STORAGE);
    if (learnerStored && isUiLanguage(learnerStored)) return learnerStored;
  } catch {
    /* ignore */
  }

  const fromDomain = domainDefaultLocale();
  if (fromDomain) return fromDomain;

  try {
    const sharedStored = localStorage.getItem(SHARED_LOCALE_STORAGE);
    if (sharedStored && isUiLanguage(sharedStored)) return sharedStored;
  } catch {
    /* ignore */
  }

  const fromBrowser = browserRuUzHint();
  if (fromBrowser) return fromBrowser;

  return 'uz';
}

export function readStoredLearnerLocale(): UiLanguage | null {
  try {
    const learnerStored = localStorage.getItem(LEARNER_LOCALE_STORAGE);
    if (learnerStored && isUiLanguage(learnerStored)) return learnerStored;
  } catch {
    /* ignore */
  }
  return null;
}

/** DB default was English — treat unset profiles on .uz as following domain locale. */
export function isLegacyDefaultEnglishUiLanguage(
  uiLanguage: string | undefined | null,
  explicitLearnerLocale: UiLanguage | null = readStoredLearnerLocale(),
): boolean {
  if (uiLanguage !== 'en') return false;
  if (domainDefaultLocale() !== 'uz') return false;
  return explicitLearnerLocale !== 'en';
}

export function persistLearnerLocale(code: UiLanguage) {
  try {
    localStorage.setItem(LEARNER_LOCALE_STORAGE, code);
    localStorage.setItem(SHARED_LOCALE_STORAGE, code);
  } catch {
    /* ignore */
  }
}
