import { localeFromQuery, type QueryLocale } from './queryLocale';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { LANGUAGE_META, type AppLanguage } from '@gotcha/shared';
import { marketingCopyFor, type MarketingCopy } from './marketingCopy';
import {
  detectWebLocale,
  marketingLocaleFor,
  persistWebLocale,
  type WebLocale,
} from './webLocale';

interface WebLocaleContextValue {
  locale: WebLocale;
  copyLocale: AppLanguage;
  copy: MarketingCopy;
  setLocale: (code: WebLocale) => void;
  localeOptions: Array<{ code: AppLanguage; label: string; nativeName: string }>;
}

const WebLocaleContext = createContext<WebLocaleContextValue | null>(null);

const PICKER_LOCALES: AppLanguage[] = ['en', 'ru', 'uz'];

/** /ru, /en and /uz select the page language. Query ?lang= / ?ui= does the same on any path. */
export function localeFromPath(pathname: string): QueryLocale | null {
  const seg = pathname.split('/').filter(Boolean)[0]?.toLowerCase();
  return seg === 'en' || seg === 'ru' || seg === 'uz' ? seg : null;
}

export function WebLocaleProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const { pathname } = useLocation();
  const pathLocale = localeFromPath(pathname);
  const [locale, setLocaleState] = useState<WebLocale>(() => pathLocale ?? detectWebLocale(typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : searchParams));

  useEffect(() => {
    // Path (/ru) wins, then ?lang= / ?ui=. Either is remembered for the next visit.
    const fromQuery = localeFromQuery(searchParams);
    if (fromQuery) persistWebLocale(fromQuery);
    const explicit = pathLocale ?? fromQuery;
    if (pathLocale) persistWebLocale(pathLocale);
    setLocaleState(explicit ?? detectWebLocale(searchParams));
  }, [searchParams, pathLocale]);

  const copyLocale = marketingLocaleFor(locale);
  const copy = useMemo(() => marketingCopyFor(copyLocale), [copyLocale]);

  useEffect(() => {
    document.documentElement.lang = copyLocale;
  }, [copyLocale]);

  const setLocale = (code: WebLocale) => {
    persistWebLocale(code);
    setLocaleState(code);
  };

  const localeOptions = useMemo(
    () =>
      PICKER_LOCALES.map((code) => ({
        code,
        label: LANGUAGE_META[code].label,
        nativeName: LANGUAGE_META[code].nativeName,
      })),
    [],
  );

  const value = useMemo(
    () => ({ locale, copyLocale, copy, setLocale, localeOptions }),
    [locale, copyLocale, copy, localeOptions],
  );

  return <WebLocaleContext.Provider value={value}>{children}</WebLocaleContext.Provider>;
}

export function useWebLocale() {
  const ctx = useContext(WebLocaleContext);
  if (!ctx) throw new Error('useWebLocale must be used within WebLocaleProvider');
  return ctx;
}

export function useMarketingCopy(): MarketingCopy {
  return useWebLocale().copy;
}
