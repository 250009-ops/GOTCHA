import { languageUiName } from '@gotcha/shared';
import type { UserTargetLanguage, VocabItem } from './types';

export type LanguageProgress = {
  code: string;
  name: string;
  level: string;
  towardLabel: string;
  pct: number;
  wordCount: number;
};

function cefrCode(raw?: string | null): string {
  const c = raw?.trim().toUpperCase().slice(0, 2);
  return c && c.length === 2 ? c : 'A1';
}

function nextCefr(code: string): string | null {
  switch (cefrCode(code)) {
    case 'A1':
      return 'A2';
    case 'A2':
      return 'B1';
    case 'B1':
      return 'B2';
    case 'B2':
      return 'C1';
    case 'C1':
      return 'C2';
    default:
      return null;
  }
}

function inferCefrCode(words: number): string {
  if (words >= 4000) return 'C1';
  if (words >= 2000) return 'B2';
  if (words >= 800) return 'B1';
  if (words >= 300) return 'A2';
  return 'A1';
}

function cefrBandProgress(words: number, code: string): number {
  const bands: Record<string, [number, number]> = {
    A1: [0, 300],
    A2: [300, 800],
    B1: [800, 2000],
    B2: [2000, 4000],
    C1: [4000, 8000],
  };
  const band = bands[cefrCode(code)];
  if (!band) return 1;
  const [lo, hi] = band;
  if (words <= lo) return 0;
  if (words >= hi) return 1;
  return (words - lo) / (hi - lo);
}

const CEFR_WORD: Record<string, Record<string, string>> = {
  en: { A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate', B2: 'Upper-Int', C1: 'Advanced', C2: 'Mastery' },
  ru: { A1: 'Начальный', A2: 'Элементарный', B1: 'Средний', B2: 'Выше среднего', C1: 'Продвинутый', C2: 'Свободный' },
  uz: { A1: 'Boshlangʻich', A2: 'Oddiy', B1: 'Oʻrta', B2: 'Oʻrtadan yuqori', C1: 'Yuqori', C2: 'Erkin' },
};

function cefrFullLabel(code: string, ui = 'en'): string {
  const c = cefrCode(code);
  const lang = ui === 'ru' || ui === 'uz' ? ui : 'en';
  return `${c} ${CEFR_WORD[lang][c] ?? c}`;
}

function towardLabel(next: string, ui = 'en'): string {
  if (ui === 'ru') return `К уровню ${next}`;
  if (ui === 'uz') return `${next} sari`;
  return `Toward ${next}`;
}

function languageName(code: string, ui = 'en'): string {
  return languageUiName(code, ui) || code.toUpperCase();
}

/**
 * Same rules as Android Progress: list languages the learner actually saved
 * words in. Do not invent a leftover signup default (historically RU).
 */
export function buildLanguageProgress(
  targetLanguages: UserTargetLanguage[] | undefined,
  vocab: VocabItem[],
  ui = 'en',
): LanguageProgress[] {
  const chosen = targetLanguages ?? [];
  const counts = new Map<string, number>();
  for (const item of vocab) {
    const lang = item.sourceLang?.trim().toLowerCase();
    if (!lang) continue;
    counts.set(lang, (counts.get(lang) ?? 0) + 1);
  }
  const activity = [...counts.entries()].filter(([, n]) => n > 0);
  if (activity.length === 0) return [];

  activity.sort((a, b) => {
    const aPrimary = chosen.some((t) => t.targetLanguage === a[0] && t.isPrimary) ? 1 : 0;
    const bPrimary = chosen.some((t) => t.targetLanguage === b[0] && t.isPrimary) ? 1 : 0;
    if (bPrimary !== aPrimary) return bPrimary - aPrimary;
    return b[1] - a[1];
  });

  return activity.map(([raw, words]) => {
    const tl = chosen.find((t) => t.targetLanguage === raw);
    const level = cefrCode(tl?.cefrLevel ?? inferCefrCode(words));
    const next = nextCefr(level);
    return {
      code: raw.toUpperCase(),
      name: languageName(raw, ui),
      level: cefrFullLabel(level, ui),
      towardLabel: next ? towardLabel(next, ui) : (ui === 'ru' ? 'Верхний уровень' : ui === 'uz' ? 'Eng yuqori' : 'Top band'),
      pct: next ? cefrBandProgress(words, level) : 1,
      wordCount: words,
    };
  });
}
