/** Re-exported from `@gotcha/shared` — the single source of truth shared with the API. */
import {
  APP_LANGUAGES,
  LIVE_LANGUAGES,
  UI_LANGUAGES,
  LANGUAGE_META,
  languageFlag,
  languageLabel,
  CEFR_LEVELS,
  CONTENT_TYPES,
  type AppLanguage,
  type CefrLevel,
  type ContentType,
  type CatalogLanguage,
} from '@gotcha/shared';

export {
  APP_LANGUAGES,
  LIVE_LANGUAGES,
  UI_LANGUAGES,
  LANGUAGE_META,
  languageFlag,
  languageLabel,
  CEFR_LEVELS,
  CONTENT_TYPES,
  type AppLanguage,
  type CefrLevel,
  type ContentType,
  type CatalogLanguage,
};

export interface UserTargetLanguage {
  targetLanguage: AppLanguage;
  cefrLevel: CefrLevel;
  isPrimary: boolean;
  placementScore?: number | null;
}

export interface UserProfile {
  id: string;  email: string;
  displayName: string;
  avatarUrl?: string | null;
  nativeLanguage: AppLanguage;
  uiLanguage: AppLanguage;
  streakCount: number;
  streakLastDate?: string | null;
  targetLanguages?: UserTargetLanguage[];
}

export interface UserStats {
  streakCount: number;
  todayMinutes: number;
  dailyGoalMinutes: number;
  wordsLearned: number;
  wordsKnown: number;
  totalReadSeconds: number;
}

export interface StatsHistoryDay {
  date: string;
  minutes: number;
  wordsSaved: number;
}

export interface StatsHistoryWeek {
  weekStart: string;
  wordsSaved: number;
}

export interface StatsHeatmapDay {
  date: string;
  count: number;
  finished?: number;
}

export interface UserStatsResponse {
  vocabularyTotal: number;
  vocabularyMastered: number;
  vocabularyDue: number;
  contentInProgress: number;
  contentCompleted: number;
  totalReadMinutes: number;
  todayReadMinutes?: number;
  wordsSaved: number;
  wordsTapped: number;
  streakCount: number;
  bestStreak: number;
  history: {
    daily: StatsHistoryDay[];
    weekly: StatsHistoryWeek[];
    heatmap: StatsHeatmapDay[];
  };
}

export interface UserPreferences {
  readerFontScale: number;
  readerTheme: 'light' | 'dark' | 'sepia';
  readerLineSpacing: number;
  showKnownWords: boolean;
  ttsEnabled: boolean;
  dailyGoalMinutes: number;
  notificationsEnabled: boolean;
}

export interface ContentItem {
  id: string;
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  language: AppLanguage;
  contentType: ContentType;
  contentSource?: string | null;
  cefrLevel: CefrLevel;
  genre?: string | null;
  coverImageUrl?: string | null;
  authorName?: string | null;
  wordCount: number;
  segmentCount?: number;
  progressPct?: number;
  knownWordRatio?: number;
  currentSegmentId?: string | null;
  outline?: ContentOutlineSegment[];
  isFree?: boolean;
  priceUzs?: number;
  accessGranted?: boolean;
  trialSegmentCount?: number;
}

export interface ContentOutlineSegment {
  id: string;
  segmentIndex: number;
  chapterIndex?: number;
  chapterTitle?: string | null;
  pageIndex?: number;
  title?: string | null;
  wordCount: number;
}

export interface ContentSegment {
  id: string;
  segmentIndex: number;
  chapterIndex?: number;
  chapterTitle?: string | null;
  pageIndex?: number;
  title?: string | null;
  plainText: string;
  tokenMap: Array<{
    i: number;
    start: number;
    end: number;
    surface: string;
    lemma: string | null;
    isWord: boolean;
  }>;
  wordCount: number;
}

export interface LookupResult {
  lemma: string;
  translation: string;
  /** How this inflected form is used in the tapped sentence (learner language). */
  contextualMeaning?: string | null;
  /** Surface span of an idiom / phrasal verb in the sentence, when the tap was one word of it. */
  phrase?: string | null;
  /** word = dictionary tap, phrase = short idiom, sentence = full translation of the selection. */
  kind?: 'word' | 'phrase' | 'sentence';
  phonetic?: string | null;
  partOfSpeech?: string | null;
  grammarNote?: string | null;
  /** True when served from shared lemma / memory cache (no OpenAI spend). */
  cached?: boolean;
}

export interface VocabItem {
  id: string;
  lemma: string;
  translation: string;
  mastered: boolean;
  contextSentence?: string | null;
  dueAt: string;
  intervalDays: number;
  repetitions: number;
  easeFactor?: number;
  lastReviewedAt?: string | null;
  notes?: string | null;
  sourceLang: AppLanguage;
  targetLang?: AppLanguage;
  content?: { id: string; title: string } | null;
}

export type WordStatus = 'unknown' | 'learning' | 'known' | 'ignored';

export interface SubscriptionPlan {
  id: string;
  tier: 'free' | 'premium';
  name: string;
  priceMonthly?: string | number | null;
  priceLabel?: string;
  priceUnit?: string;
  aiDailyQuota: number;
  importLimit: number;
  offlineEnabled: boolean;
  popular?: boolean;
  features?: string[];
}

export interface SubscriptionInfo {
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd?: string | null;
    plan: SubscriptionPlan;
  } | null;
  usage: {
    lookupsToday: number;
    quizzesToday: number;
    quota: number;
    importAllowance?: {
      gatewayEnabled: boolean;
      resetCycle: string;
      allowedFormats: string[];
      dailyFreeImportsPerUser: number;
      dailyFreeUsed: number;
      dailyFreeRemaining: number;
      monthlyFreePageLimit: number;
      monthlyPagesUsed: number;
      monthlyPagesRemaining: number;
    };
  };
}

export type ApiSrsRating = 'again' | 'hard' | 'good' | 'easy';

/** Cover-art gradients matching the Figma book-cover palette (deterministic per content id). */
export const COVER_GRADIENTS = [
  'linear-gradient(148deg, #8e51ff 0%, #ad46ff 50%, #4f39f6 100%)',
  'linear-gradient(142deg, #00d492 0%, #00bba7 50%, #0092b8 100%)',
  'linear-gradient(142deg, #fb2c6b 0%, #f6339a 50%, #e60076 100%)',
  'linear-gradient(148deg, #2b7fff 0%, #6a5cff 50%, #4f39f6 100%)',
  'linear-gradient(142deg, #ffb900 0%, #ff8904 50%, #e6360a 100%)',
  'linear-gradient(142deg, #05df72 0%, #00c951 50%, #00966b 100%)',
];

export function gradientForId(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % COVER_GRADIENTS.length;
  return COVER_GRADIENTS[hash];
}

export function avatarInitials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
