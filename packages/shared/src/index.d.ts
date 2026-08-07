export declare const APP_LANGUAGES: readonly ["en", "ru", "uz"];
export type AppLanguage = (typeof APP_LANGUAGES)[number];
export declare const CEFR_LEVELS: readonly ["a1", "a2", "b1", "b2", "c1", "c2"];
export type CefrLevel = (typeof CEFR_LEVELS)[number];
export declare const CONTENT_TYPES: readonly ["book", "article", "story", "news", "user_import"];
export type ContentType = (typeof CONTENT_TYPES)[number];
export declare const SRS_RATINGS: readonly ["again", "hard", "good", "easy"];
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
