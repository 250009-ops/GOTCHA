export const APP_LANGUAGES = ['en', 'ru', 'uz'] as const;
export type AppLanguage = (typeof APP_LANGUAGES)[number];

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
