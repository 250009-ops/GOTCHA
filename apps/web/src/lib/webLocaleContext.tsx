import { localeFromQuery } from './queryLocale';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
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

export function WebLocaleProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams();
  const [locale, setLocaleState] = useState<WebLocale>(() => detectWebLocale(searchParams));

  useEffect(() => {
    // S3c: ?lang= / ?ui= translate the page and are remembered for the next visit.
    const fromQuery = localeFromQuery(searchParams);
    if (fromQuery) persistWebLocale(fromQuery);
    setLocaleState(detectWebLocale(searchParams));
  }, [searchParams]);

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
