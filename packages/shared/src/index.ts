/** Shared language catalog — keep in sync with Prisma `AppLanguage` enum. */
export const APP_LANGUAGES = [
  'en', 'ru', 'uz', 'fr', 'es', 'ja', 'de', 'ko', 'pt',
  'ar', 'bn', 'bg', 'ca', 'zh', 'hr', 'cs', 'da', 'nl', 'fi',
  'el', 'he', 'hi', 'hu', 'id', 'it', 'ms', 'no', 'fa', 'pl',
  'ro', 'sr', 'sk', 'sw', 'sv', 'tl', 'th', 'tr', 'uk', 'ur', 'vi',
] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

/** Languages enabled by default for a fresh catalog (admin can turn on the rest). */
export const LIVE_LANGUAGES = ['en', 'ru', 'uz'] as const;
export type LiveLanguage = (typeof LIVE_LANGUAGES)[number];

/** Interface / UI localization only — not the learning-language catalog. */
export const UI_LANGUAGES = ['en', 'ru', 'uz'] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export function isLiveLanguage(code?: string | null): code is LiveLanguage {
  return !!code && (LIVE_LANGUAGES as readonly string[]).includes(code);
}

export const LANGUAGE_META: Record<
  AppLanguage,
  { label: string; nativeName: string; flag: string }
> = {
  en: { label: 'English', nativeName: 'English', flag: '🇬🇧' },
  ru: { label: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  uz: { label: 'Uzbek', nativeName: "Oʻzbekcha", flag: '🇺🇿' },
  fr: { label: 'French', nativeName: 'Français', flag: '🇫🇷' },
  es: { label: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  ja: { label: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  de: { label: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  ko: { label: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  pt: { label: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  ar: { label: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  bn: { label: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  bg: { label: 'Bulgarian', nativeName: 'Български', flag: '🇧🇬' },
  ca: { label: 'Catalan', nativeName: 'Català', flag: '🇦🇩' },
  zh: { label: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  hr: { label: 'Croatian', nativeName: 'Hrvatski', flag: '🇭🇷' },
  cs: { label: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  da: { label: 'Danish', nativeName: 'Dansk', flag: '🇩🇰' },
  nl: { label: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱' },
  fi: { label: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮' },
  el: { label: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷' },
  he: { label: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  hi: { label: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  hu: { label: 'Hungarian', nativeName: 'Magyar', flag: '🇭🇺' },
  id: { label: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  it: { label: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  ms: { label: 'Malay', nativeName: 'Bahasa Melayu', flag: '🇲🇾' },
  no: { label: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴' },
  fa: { label: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  pl: { label: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  ro: { label: 'Romanian', nativeName: 'Română', flag: '🇷🇴' },
  sr: { label: 'Serbian', nativeName: 'Српски', flag: '🇷🇸' },
  sk: { label: 'Slovak', nativeName: 'Slovenčina', flag: '🇸🇰' },
  sw: { label: 'Swahili', nativeName: 'Kiswahili', flag: '🇰🇪' },
  sv: { label: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪' },
  tl: { label: 'Tagalog', nativeName: 'Tagalog', flag: '🇵🇭' },
  th: { label: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  tr: { label: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  uk: { label: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  ur: { label: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  vi: { label: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
};

export function languageMetaOf(code?: string | null): {
  label: string;
  nativeName: string;
  flag: string;
} {
  const key = (code ?? '').trim().toLowerCase() as AppLanguage;
  return (
    LANGUAGE_META[key] ?? {
      label: (code ?? '').toUpperCase() || 'Unknown',
      nativeName: code ?? '',
      flag: '🌐',
    }
  );
}

export function languageLabel(code?: string | null): string {
  return languageMetaOf(code).label;
}

export function languageFlag(code?: string | null): string {
  return languageMetaOf(code).flag;
}

/** Full name + ISO code for AI prompts so the model does not guess from a 2-letter tag. */
export function languagePromptLabel(code?: string | null): string {
  const key = (code ?? '').trim().toLowerCase();
  const meta = languageMetaOf(code);
  return key ? `${meta.label} (${key})` : meta.label;
}

export const CEFR_LEVELS = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'] as const;
export type CefrLevel = (typeof CEFR_LEVELS)[number];

export const CONTENT_TYPES = ['book', 'article', 'story', 'news', 'user_import'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const SRS_RATINGS = ['again', 'hard', 'good', 'easy'] as const;
export type SrsRating = (typeof SRS_RATINGS)[number];

export interface TokenMapEntry {
  i: number;
  start: number;
  end: number;
  surface: string;
  lemma: string | null;
  isWord: boolean;
}

export interface SentenceMapEntry {
  index: number;
  start: number;
  end: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

export interface CatalogLanguage {
  code: AppLanguage | string;
  name: string;
  nativeName: string;
  flagEmoji: string;
  isEnabled: boolean;
}
