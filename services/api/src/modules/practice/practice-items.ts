import type { UserVocabulary } from '@prisma/client';
import { shuffle, type buildCloze, type ExerciseType } from '@gotcha/shared';

type VocabRow = Pick<UserVocabulary, 'id' | 'lemma' | 'translation' | 'contextSentence' | 'sourceLang' | 'targetLang'> & {
  content?: { id: string; title: string } | null;
};

/** Item payload. Never contains the answer of a production exercise (PRD §4 AC7). */
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

export function buildPracticeItem(
  v: VocabRow,
  type: ExerciseType,
  extra: boolean,
  cloze: ReturnType<typeof buildCloze>,
  distractors: string[],
  rand: () => number,
  ): PracticeItem {
  const base: PracticeItem = {
    key: `${v.id}:${type}`,
    vocabId: v.id,
    type,
    lang: v.sourceLang,
    nativeLang: v.targetLang,
    extra,
    source: v.content ? { contentId: v.content.id, title: v.content.title } : null,
  };
  const hint = { firstLetter: v.lemma[0] ?? '', length: [...v.lemma].length, words: v.lemma.trim().split(/\s+/).length };
  switch (type) {
    case 'flashcard':
      // Self-rated recognition: the back is part of the card by design.
      return { ...base, word: v.lemma, translation: v.translation, context: v.contextSentence, hasAudio: true };
    case 'mcq_meaning':
      return { ...base, word: v.lemma, context: v.contextSentence, options: shuffle([v.translation, ...distractors], rand), hasAudio: true };
    case 'typed_recall':
      return { ...base, translation: v.translation, hint };
    case 'cloze':
    case 'cloze_mcq':
      return {
        ...base,
        translation: v.translation,
        cloze: cloze ? { before: cloze.before, after: cloze.after, hint: cloze.hint, length: [...cloze.answer].length } : undefined,
        ...(type === 'cloze_mcq' ? { options: shuffle([cloze?.answer ?? v.lemma, ...distractors], rand) } : { hint }),
      };
    case 'listening_mcq':
      return { ...base, hasAudio: true, options: shuffle([v.lemma, ...distractors], rand) };
    case 'dictation':
      return { ...base, hasAudio: true, hint };
  }
}
