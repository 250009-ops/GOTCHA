// wlive port of payments-02: wlive has no learner locale provider; the UI language is the profile's uiLanguage
// (LearnerShell mirrors it on <html lang>). Payments components only need { locale }.
import type { UiLanguage } from '@gotcha/shared';
import { useAuth } from './auth';

export function learnerLocaleOf(ui: string | null | undefined): UiLanguage {
  return ui === 'uz' || ui === 'ru' ? ui : 'en';
}

export function useLearnerLocale(): { locale: UiLanguage } {
  const { user } = useAuth();
  return { locale: learnerLocaleOf(user?.uiLanguage) };
}
