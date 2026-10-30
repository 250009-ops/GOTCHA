import type { UiLanguage } from './index';

/** UI language picker labels — flags are SVG components in each web app. */
export const UI_LANGUAGE_PICKER: Record<
  UiLanguage,
  { nativeName: string; shortName: string }
> = {
  en: { nativeName: 'English', shortName: 'Eng' },
  ru: { nativeName: 'Русский', shortName: 'Ru' },
  uz: { nativeName: "O'zbekcha", shortName: 'Uzb' },
};
