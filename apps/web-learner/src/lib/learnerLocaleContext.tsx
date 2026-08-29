import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  LANGUAGE_META,
  UI_LANGUAGES,
  type FullLearnerCopy,
  type UiLanguage,
} from '@gotcha/shared';
import { learnerCopyFor } from '@gotcha/shared/learner-copy';
import { useAuth } from './auth';
import { detectLearnerLocale, persistLearnerLocale } from './learnerLocale';

interface LearnerLocaleContextValue {
  locale: UiLanguage;
  copy: FullLearnerCopy;
  setLocale: (code: UiLanguage) => void;
  localeOptions: Array<{ code: UiLanguage; label: string; nativeName: string }>;
}

const LearnerLocaleContext = createContext<LearnerLocaleContextValue | null>(null);

export function LearnerLocaleProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [guestLocale, setGuestLocale] = useState<UiLanguage>(() => detectLearnerLocale(searchParams));

  useEffect(() => {
    if (!user) setGuestLocale(detectLearnerLocale(searchParams));
  }, [searchParams, user]);

  const locale: UiLanguage = user?.uiLanguage && UI_LANGUAGES.includes(user.uiLanguage as UiLanguage)
    ? (user.uiLanguage as UiLanguage)
    : guestLocale;

  const copy = useMemo(() => learnerCopyFor(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback(
    (code: UiLanguage) => {
      persistLearnerLocale(code);
      if (user) {
        void updateProfile({ uiLanguage: code }).catch(() => undefined);
      } else {
        setGuestLocale(code);
      }
    },
    [user, updateProfile],
  );

  const localeOptions = useMemo(
    () =>
      UI_LANGUAGES.map((code) => ({
        code,
        label: LANGUAGE_META[code].label,
        nativeName: LANGUAGE_META[code].nativeName,
      })),
    [],
  );

  const value = useMemo(
    () => ({ locale, copy, setLocale, localeOptions }),
    [locale, copy, setLocale, localeOptions],
  );

  return <LearnerLocaleContext.Provider value={value}>{children}</LearnerLocaleContext.Provider>;
}

export function useLearnerLocale() {
  const ctx = useContext(LearnerLocaleContext);
  if (!ctx) throw new Error('useLearnerLocale must be used within LearnerLocaleProvider');
  return ctx;
}

export function useLearnerCopy(): FullLearnerCopy {
  return useLearnerLocale().copy;
}

/** Guest locale before registration — pass to register API via updateProfile after signup. */
export function useGuestLocale(): UiLanguage {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [guestLocale] = useState<UiLanguage>(() => detectLearnerLocale(searchParams));
  if (user?.uiLanguage && UI_LANGUAGES.includes(user.uiLanguage as UiLanguage)) {
    return user.uiLanguage as UiLanguage;
  }
  return guestLocale;
}
