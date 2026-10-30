import type { ExerciseType, SrsRatingValue, DiffPart } from '@gotcha/shared';
import { api, apiAudio } from '../../lib/api';

export interface PracticeItem {
  key: string;
  vocabId: string;
  type: ExerciseType;
  lang: string;
  nativeLang: string;
  extra: boolean;
  source?: { contentId: string; title: string } | null;
  word?: string;
  translation?: string;
  context?: string | null;
  options?: string[];
  cloze?: { before: string; after: string; hint: string; length: number };
  hasAudio?: boolean;
  hint?: { firstLetter: string; length: number; words: number };
}

export interface ProgressStats {
  xpToday: number;
  xpTotal: number;
  dailyGoalXp: number;
  streakCount: number;
  bestStreak?: number;
  streakFreezes: number;
}

export interface Overview extends ProgressStats {
  dueCount: number;
  newCount: number;
  totalWords: number;
  masteredWords: number;
  accuracy: number;
  dailyNewWords: number;
  practicedToday: boolean;
  forecast: Array<{ date: string; count: number }>;
}

export interface DailySession extends ProgressStats {
  sessionId: string | null;
  items: PracticeItem[];
  caughtUp: boolean;
  totalWords: number;
}

export interface AnswerResult extends ProgressStats {
  correct: boolean;
  verdict: 'correct' | 'almost' | 'wrong';
  reason: 'typo' | 'diacritics' | 'uz_apostrophe' | 'wrong_script' | 'real_word' | 'empty' | null;
  diff: DiffPart[];
  judgedByAi: boolean;
  expected: string;
  word: string;
  translation: string;
  context: string | null;
  rating: SrsRatingValue;
  requeue: boolean;
  nextDueAt: string;
  intervalDays: number;
  xpGained: number;
  goalReached: boolean;
  goalReachedNow: boolean;
  streakExtended: boolean;
  freezesUsed: number;
}

export interface SessionSummary extends ProgressStats {
  answered: number;
  correct: number;
  accuracy: number;
  xpEarned: number;
  bonusXp: number;
  newWords: number;
  mistakes: Array<{ vocabId: string; word: string; translation: string; nextDueAt: string }>;
  hardest: string[];
  dueTomorrow: number;
  goalReached?: boolean;
  streakExtended?: boolean;
}

export const practiceApi = {
  overview: () => api<Overview>('/practice/overview'),
  daily: (q: { size: number; caps: string[]; focus?: string[]; extra?: boolean }) => {
    const p = new URLSearchParams({ size: String(q.size) });
    if (q.caps.length) p.set('caps', q.caps.join(','));
    if (q.focus?.length) p.set('focus', q.focus.join(','));
    if (q.extra) p.set('extra', '1');
    return api<DailySession>(`/practice/daily?${p.toString()}`);
  },
  answer: (body: {
    answerId: string;
    sessionId?: string | null;
    vocabId: string;
    type: ExerciseType;
    answer?: string;
    selfRating?: SrsRatingValue;
    responseMs: number;
    hintUsed?: boolean;
    extra?: boolean;
  }) =>
    api<AnswerResult>('/practice/answer', {
      method: 'POST',
      body: JSON.stringify({ ...body, sessionId: body.sessionId ?? undefined }),
    }),
  complete: (sessionId: string) => api<SessionSummary>(`/practice/daily/${sessionId}/complete`, { method: 'POST' }),
  setGoal: (dailyGoalXp: number) =>
    api('/users/me/preferences', { method: 'PATCH', body: JSON.stringify({ dailyGoalXp }) }),
  audio: (vocabId: string) => apiAudio('/practice/audio', { vocabId }),
};

export function newAnswerId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
