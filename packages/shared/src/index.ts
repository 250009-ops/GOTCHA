/** Shared language catalog — keep in sync with Prisma `AppLanguage` enum. */
export const APP_LANGUAGES = ['en', 'ru', 'uz', 'fr', 'es', 'ja', 'de', 'ko', 'pt'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

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
};

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
