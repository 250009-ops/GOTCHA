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
import {
  detectLearnerLocale,
  isLegacyDefaultEnglishUiLanguage,
  LEARNER_LOCALE_STORAGE,
  SHARED_LOCALE_STORAGE,
  persistLearnerLocale,
  readStoredLearnerLocale,
} from './learnerLocale';

interface LearnerLocaleContextValue {
  locale: UiLanguage;
  copy: FullLearnerCopy;
  setLocale: (code: UiLanguage) => Promise<void>;
  localeOptions: Array<{ code: UiLanguage; label: string; nativeName: string }>;
}

const LearnerLocaleContext = createContext<LearnerLocaleContextValue | null>(null);

export function LearnerLocaleProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [searchParams] = useSearchParams();
  const [guestLocale, setGuestLocale] = useState<UiLanguage>(() => detectLearnerLocale(searchParams));
  const [picked, setPicked] = useState<UiLanguage | null>(null);

  useEffect(() => {
    if (!user) setGuestLocale(detectLearnerLocale(searchParams));
  }, [searchParams, user]);

  const locale: UiLanguage = useMemo(() => {
    if (picked) return picked;
    // WLF-36: an explicit ?ui= on a guest page (landing CTA → /learn/register?ui=en) wins over an older stored choice.
    const urlUi = (searchParams.get('ui') || '').toLowerCase().slice(0, 2);
    if (!user && UI_LANGUAGES.includes(urlUi as UiLanguage)) return urlUi as UiLanguage;
    const stored = readStoredLearnerLocale();
    if (stored) return stored;

    const profileUi = user?.uiLanguage;
    if (
      profileUi &&
      UI_LANGUAGES.includes(profileUi as UiLanguage) &&
      !isLegacyDefaultEnglishUiLanguage(profileUi, stored)
    ) {
      return profileUi as UiLanguage;
    }

    return guestLocale;
  }, [picked, user, user?.uiLanguage, guestLocale, searchParams]);

  const copy = useMemo(() => learnerCopyFor(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    if (!user?.uiLanguage) return;
    const stored = readStoredLearnerLocale();
    if (!isLegacyDefaultEnglishUiLanguage(user.uiLanguage, stored)) return;
    const resolved = detectLearnerLocale(searchParams);
    persistLearnerLocale(resolved);
    void updateProfile({ uiLanguage: resolved }).catch(() => undefined);
  }, [user?.id, user?.uiLanguage, searchParams, updateProfile]);

  const setLocale = useCallback(
    (code: UiLanguage) => {
      const prev = readStoredLearnerLocale();
      setPicked(code);
      persistLearnerLocale(code);
      if (!user) {
        setGuestLocale(code);
        return Promise.resolve();
      }
      return updateProfile({ uiLanguage: code }).catch((err: unknown) => {
        if (prev) persistLearnerLocale(prev);
        else {
          try {
            localStorage.removeItem(LEARNER_LOCALE_STORAGE);
            localStorage.removeItem(SHARED_LOCALE_STORAGE);
          } catch {
            /* private mode */
          }
        }
        setPicked(prev);
        throw err;
      });
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
  const stored = readStoredLearnerLocale();
  if (stored) return stored;
  const profileUi = user?.uiLanguage;
  if (
    profileUi &&
    UI_LANGUAGES.includes(profileUi as UiLanguage) &&
    !isLegacyDefaultEnglishUiLanguage(profileUi, stored)
  ) {
    return profileUi as UiLanguage;
  }
  return guestLocale;
}
