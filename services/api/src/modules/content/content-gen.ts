import { uzOrthography } from '@gotcha/shared';
import { normalizePartOfSpeech } from '../ai/lookup-normalize';
import {
  citedNumbers,
  foldSpace,
  groundPageItems,
  numbersGrounded,
  parsePageBankItems,
  quoteInPassage,
  type PageBankItem,
} from '../ai/quiz-grounding';

export const GENERATOR_VERSION = 'cursor-v1';
export const DICTIONARY_CHUNK = 300;
export const MASHQ_CHUNK = 20;

export type Sense = { meaning: string; pos: string; example?: string };
export type SenseBag = { uz?: Sense[]; ru?: Sense[]; en?: Sense[] };

/** surface is the tapped form and the lookup key. lemma is the citation form (стал → стать). */
export type DictEntry = { surface: string; headword: string; senses: SenseBag };
export type DictFile = { sourceLang: string; generatorVersion: string; entries: DictEntry[] };

export type QuizQuestion = {
  promptI18n: { en: string; uz: string; ru: string };
  optionsI18n: { en: string[]; uz: string[]; ru: string[] };
  answerIndex: number;
  evidenceQuote: string;
  explanationI18n: { en: string; uz: string; ru: string };
};

export type MashqPage = { segmentId: string; contentId: string; segmentIndex: number; questions: QuizQuestion[] };
export type MashqFile = { contentId: string; generatorVersion: string; pages: MashqPage[] };

export type CatalogPage = { text: string; sourceLang: string; contentId: string; segmentIndex: number };

const LANGS = ['en', 'uz', 'ru'] as const;
type Lang = (typeof LANGS)[number];

/** Learner's native language is never a gloss target for that same source. */
export function targetLanguages(sourceLang: string): Lang[] {
  if (sourceLang === 'en') return ['uz', 'ru'];
  if (sourceLang === 'ru') return ['uz', 'en'];
  if (sourceLang === 'uz') return ['en', 'ru'];
  return [...LANGS];
}

export function chunkBy<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** ASCII or curly apostrophes after o/g are not the Uzbek oʻ/gʻ mark (U+02BB). */
export function uzbekApostrophesOk(text: string): boolean {
  return !/[oOgG][''`´‘’ʼ\u02BC]/.test(text);
}

function nonEmpty(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text ? text : null;
}

function senseList(raw: unknown, lang: Lang): { ok: true; senses: Sense[] } | { ok: false; reason: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 3) {
    return { ok: false, reason: `${lang} needs 1 to 3 senses` };
  }
  const senses: Sense[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') return { ok: false, reason: `${lang} sense is not an object` };
    const rec = row as Record<string, unknown>;
    const meaning = nonEmpty(rec.meaning);
    const pos = normalizePartOfSpeech(rec.pos);
    if (!meaning || !pos) return { ok: false, reason: `${lang} sense needs meaning and pos` };
    const example = rec.example == null || rec.example === '' ? undefined : nonEmpty(rec.example);
    if (rec.example != null && rec.example !== '' && !example) return { ok: false, reason: `${lang} example is empty` };
    if (lang === 'uz') {
      if (!uzbekApostrophesOk(meaning) || (example && !uzbekApostrophesOk(example))) {
        return { ok: false, reason: 'uzbek apostrophe' };
      }
      const fixed = uzOrthography(meaning);
      if (/[\u0400-\u04FF]/.test(fixed) && !/[a-z\u02BB\u02BC]/i.test(fixed)) return { ok: false, reason: 'uzbek is cyrillic' };
      senses.push({ meaning: fixed, pos, ...(example ? { example: uzOrthography(example) } : {}) });
    } else if (lang === 'ru') {
      if (!/[а-яё]/i.test(meaning)) return { ok: false, reason: 'russian is not cyrillic' };
      senses.push({ meaning, pos, ...(example ? { example } : {}) });
    } else {
      if (!/[a-z]/i.test(meaning)) return { ok: false, reason: 'english meaning has no latin letter' };
      senses.push({ meaning, pos, ...(example ? { example } : {}) });
    }
  }
  return { ok: true, senses };
}

export function validateDictEntry(raw: unknown, sourceLang: string): { ok: true; entry: DictEntry } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'entry is not an object' };
  const rec = raw as Record<string, unknown>;
  const surface = nonEmpty(rec.surface);
  const headword = nonEmpty(rec.lemma);
  if (!surface) return { ok: false, reason: 'missing surface' };
  if (!headword) return { ok: false, reason: 'missing lemma' };
  const senses = rec.senses;
  if (!senses || typeof senses !== 'object') return { ok: false, reason: 'missing senses' };
  const bag = senses as Record<string, unknown>;
  const forbidden = sourceLang === 'en' || sourceLang === 'ru' || sourceLang === 'uz' ? sourceLang : null;
  if (forbidden && Array.isArray(bag[forbidden]) && (bag[forbidden] as unknown[]).length > 0) {
    return { ok: false, reason: 'same-language target' };
  }
  const built: SenseBag = {};
  for (const lang of targetLanguages(sourceLang)) {
    const parsed = senseList(bag[lang], lang);
    if (!parsed.ok) return parsed;
    built[lang] = parsed.senses;
  }
  return { ok: true, entry: { surface, headword, senses: built } };
}

export function validateDictFile(
  raw: unknown,
  fileLang = '',
): { ok: Array<DictEntry & { sourceLang: string }>; rejected: Array<{ lemma: string; reason: string }> } {
  const entries = raw && typeof raw === 'object' && Array.isArray((raw as DictFile).entries)
    ? (raw as DictFile).entries
    : [];
  const ok: Array<DictEntry & { sourceLang: string }> = [];
  const rejected: Array<{ lemma: string; reason: string }> = [];
  for (const row of entries) {
    const rec = row as DictEntry & { sourceLang?: string; surface?: string };
    const sourceLang = /^[a-z]{2}$/.test(String(rec?.sourceLang ?? '')) ? String(rec.sourceLang) : fileLang;
    const label = String(rec?.surface ?? (row as { lemma?: string })?.lemma ?? '');
    if (!/^[a-z]{2}$/.test(sourceLang)) {
      rejected.push({ lemma: label, reason: 'missing source language' });
      continue;
    }
    const parsed = validateDictEntry(row, sourceLang);
    if (parsed.ok) ok.push({ ...parsed.entry, sourceLang });
    else rejected.push({ lemma: label, reason: parsed.reason });
  }
  return { ok, rejected };
}

function toBank(question: QuizQuestion): PageBankItem {
  return {
    prompt: question.promptI18n,
    options: question.optionsI18n,
    answerIndex: question.answerIndex,
    evidenceQuote: question.evidenceQuote,
    explanation: question.explanationI18n,
  };
}

function pageLanguage(sourceLang: string): Lang | null {
  return sourceLang === 'en' || sourceLang === 'ru' || sourceLang === 'uz' ? sourceLang : null;
}

/** Correct option shares a word (or a number) with the page. Other source languages rely on the quote. */
export function questionRefersToPage(question: QuizQuestion, pageText: string, sourceLang: string): boolean {
  if (!quoteInPassage(pageText, question.evidenceQuote)) return false;
  const lang = pageLanguage(sourceLang);
  if (!lang) return true;
  const answer = question.optionsI18n[lang]?.[question.answerIndex] ?? '';
  const page = foldSpace(pageText).toLowerCase();
  const words = answer.toLowerCase().match(/\p{L}{4,}/gu) ?? [];
  if (words.some((word) => page.includes(word))) return true;
  const nums = citedNumbers(answer);
  return nums.length > 0 && nums.every((n) => pageText.includes(n));
}

export function validateQuizQuestion(
  raw: unknown,
  pageText: string,
  sourceLang: string,
): { ok: true; question: QuizQuestion } | { ok: false; reason: string } {
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'question is not an object' };
  const rec = raw as Record<string, unknown>;
  const question: QuizQuestion = {
    promptI18n: rec.promptI18n as QuizQuestion['promptI18n'],
    optionsI18n: rec.optionsI18n as QuizQuestion['optionsI18n'],
    answerIndex: Number(rec.answerIndex),
    evidenceQuote: String(rec.evidenceQuote ?? ''),
    explanationI18n: rec.explanationI18n as QuizQuestion['explanationI18n'],
  };
  const bank = toBank(question);
  const uzBits = [
    question.promptI18n?.uz,
    question.explanationI18n?.uz,
    ...(question.optionsI18n?.uz ?? []),
  ];
  if (uzBits.some((bit) => typeof bit === 'string' && bit && !uzbekApostrophesOk(bit))) {
    return { ok: false, reason: 'uzbek apostrophe' };
  }
  const grounded = groundPageItems(parsePageBankItems([bank]), pageText);
  if (grounded.length !== 1) return { ok: false, reason: 'failed grounding' };
  for (const lang of LANGS) {
    const prompt = question.promptI18n?.[lang] ?? '';
    const explanation = question.explanationI18n?.[lang] ?? '';
    if (!numbersGrounded(`${prompt}\n${explanation}`, pageText)) return { ok: false, reason: 'number not on page' };
  }
  const fixed = grounded[0];
  const out: QuizQuestion = {
    promptI18n: {
      en: fixed.prompt.en,
      uz: uzOrthography(fixed.prompt.uz),
      ru: fixed.prompt.ru,
    },
    optionsI18n: {
      en: fixed.options.en,
      uz: fixed.options.uz.map((option) => uzOrthography(option)),
      ru: fixed.options.ru,
    },
    answerIndex: fixed.answerIndex,
    evidenceQuote: fixed.evidenceQuote,
    explanationI18n: {
      en: fixed.explanation.en,
      uz: uzOrthography(fixed.explanation.uz),
      ru: fixed.explanation.ru,
    },
  };
  if (!questionRefersToPage(out, pageText, sourceLang)) return { ok: false, reason: 'options do not refer to the page' };
  return { ok: true, question: out };
}

export function validateMashqFile(
  raw: unknown,
  pages: Map<string, CatalogPage & { id?: string }>,
): { ok: MashqPage[]; rejected: Array<{ segmentId: string; index: number; reason: string }> } {
  const file = raw && typeof raw === 'object' ? raw as MashqFile : null;
  const list = file && Array.isArray(file.pages) ? file.pages : [];
  const byPos = new Map<string, CatalogPage & { id: string }>();
  for (const [id, row] of pages) {
    if (!row.contentId || !Number.isInteger(row.segmentIndex)) continue;
    byPos.set(`${row.contentId}:${row.segmentIndex}`, { ...row, id });
  }
  const ok: MashqPage[] = [];
  const rejected: Array<{ segmentId: string; index: number; reason: string }> = [];
  for (const page of list) {
    const segmentId = String(page?.segmentId ?? '');
    const contentId = String(page?.contentId ?? file?.contentId ?? '');
    const segmentIndex = Number(page?.segmentIndex);
    if (!contentId || !Number.isInteger(segmentIndex) || segmentIndex < 0) {
      rejected.push({ segmentId, index: -1, reason: 'missing segment' });
      continue;
    }
    const known = byPos.get(`${contentId}:${segmentIndex}`);
    if (!known) {
      rejected.push({ segmentId, index: -1, reason: 'unknown segment' });
      continue;
    }
    if (segmentId && segmentId !== known.id) {
      rejected.push({ segmentId, index: -1, reason: 'segment id does not match index' });
      continue;
    }
    const questions: QuizQuestion[] = [];
    const rows = Array.isArray(page.questions) ? page.questions : [];
    rows.forEach((row, index) => {
      const parsed = validateQuizQuestion(row, known.text, known.sourceLang);
      if (parsed.ok) questions.push(parsed.question);
      else rejected.push({ segmentId: known.id, index, reason: parsed.reason });
    });
    if (questions.length >= 5 && questions.length <= 8) {
      ok.push({ segmentId: known.id, contentId, segmentIndex, questions });
    } else if (questions.length) {
      rejected.push({ segmentId: known.id, index: -1, reason: `only ${questions.length} valid questions` });
    }
  }
  return { ok, rejected };
}
