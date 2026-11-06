/** Deterministic checks for quiz items. A number in an answer or explanation must appear in the passage (1717 is not 1917). */

export type GroundableQuestion = {
  prompt?: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  evidenceQuote?: string;
};

export type GroundOptions = {
  /** Multiple choice must have exactly 4 unique options, and the answer must be one of them. */
  requireOptions?: boolean;
  /** The blank answer must be a word copied from the passage, and the prompt must contain a blank. */
  cloze?: boolean;
  /** evidenceQuote must be a verbatim span of the passage. */
  requireEvidence?: boolean;
};

export type PageBankItem = {
  prompt: { en: string; uz: string; ru: string };
  options: { en: string[]; uz: string[]; ru: string[] };
  answerIndex: number;
  evidenceQuote: string;
  explanation: { en: string; uz: string; ru: string };
};

const LANGS = ['en', 'uz', 'ru'] as const;

export function citedNumbers(text: string): string[] {
  return [...String(text ?? '').matchAll(/\d{3,}/g)].map((match) => match[0]);
}

export function numbersGrounded(claim: string, passage: string): boolean {
  return citedNumbers(claim).every((n) => passage.includes(n));
}

export function foldSpace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/** Publisher ads and license blocks are not the book. Drop those sentences before a page quiz is written. */
const PUBLISHER_BOILERPLATE = /planet\s*e-?books?|project gutenberg|this (?:e-?book|ebook) is for the use of anyone|gutenberg\.org|subscribe (?:to|for)|free ebooks? at|www\.planetebook/i;

export function readingPassage(text: string): string {
  const raw = String(text ?? '');
  const parts = raw.split(/(?<=[.!?…])\s+|\n+/).map((part) => part.trim()).filter(Boolean);
  const kept = parts.filter((part) => !PUBLISHER_BOILERPLATE.test(part));
  const out = foldSpace(kept.join(' '));
  return out.length >= 80 ? out : foldSpace(raw);
}

export function quoteInPassage(passage: string, quote: string): boolean {
  const q = foldSpace(quote);
  if (q.length < 8) return false;
  return foldSpace(passage).includes(q);
}

function answerKey(value: string): string {
  return value.trim().toLowerCase().replace(/[.?!…]+$/g, '').replace(/\s+/g, ' ');
}

function optionsAreDistinct(options: string[]): boolean {
  const keys = options.map(answerKey);
  if (new Set(keys).size !== keys.length) return false;
  for (let i = 0; i < keys.length; i++) {
    for (let j = 0; j < keys.length; j++) {
      if (i !== j && keys[i].length > 0 && keys[j].includes(keys[i]) && keys[i] !== keys[j]) return false;
    }
  }
  return true;
}

export function groundQuizQuestions<T extends GroundableQuestion>(
  questions: T[],
  passage: string,
  opts: GroundOptions = {},
): T[] {
  return questions.filter((q) => {
    const prompt = String(q.prompt ?? '').trim();
    const answer = String(q.correctAnswer ?? '').trim();
    const explanation = String(q.explanation ?? '');
    if (!prompt || !answer) return false;
    if (!numbersGrounded(`${answer}\n${explanation}`, passage)) return false;
    if (opts.requireEvidence && !quoteInPassage(passage, String(q.evidenceQuote ?? ''))) return false;
    const options = (q.options ?? []).map((option) => String(option).trim()).filter(Boolean);
    if (opts.cloze) {
      if (!/_{3,}|___/.test(prompt)) return false;
      return foldSpace(passage).toLowerCase().includes(foldSpace(answer).toLowerCase());
    }
    if (opts.requireOptions || options.length > 0) {
      if (options.length !== 4 || !optionsAreDistinct(options)) return false;
      if (!options.map(answerKey).includes(answerKey(answer))) return false;
    }
    return true;
  });
}

function cleanUz(value: string): string {
  return value.replace(/[\u2018\u2019']/g, '\u02BB');
}

function langBag(value: unknown, uz: boolean): { en: string; uz: string; ru: string } | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const en = String(row.en ?? '').trim();
  const ru = String(row.ru ?? '').trim();
  const uzText = cleanUz(String(row.uz ?? '').trim());
  if (!en || !ru || !uzText) return null;
  if (uz && /[а-яё]/i.test(uzText) && !/[a-zʻʼ]/i.test(uzText)) return null;
  if (!/[а-яё]/i.test(ru)) return null;
  return { en, uz: uzText, ru };
}

function optionBag(value: unknown): { en: string[]; uz: string[]; ru: string[] } | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const out = {} as { en: string[]; uz: string[]; ru: string[] };
  for (const lang of LANGS) {
    const list = Array.isArray(row[lang]) ? row[lang].map((item) => String(item).trim()).filter(Boolean) : [];
    const cleaned = lang === 'uz' ? list.map(cleanUz) : list;
    if (cleaned.length !== 4 || !optionsAreDistinct(cleaned)) return null;
    out[lang] = cleaned;
  }
  return out;
}

export function groundPageItems(items: PageBankItem[], passage: string): PageBankItem[] {
  return items.filter((item) => {
    if (!quoteInPassage(passage, item.evidenceQuote)) return false;
    if (!Number.isInteger(item.answerIndex) || item.answerIndex < 0 || item.answerIndex > 3) return false;
    for (const lang of LANGS) {
      const options = item.options[lang];
      const answer = options[item.answerIndex] ?? '';
      const claim = `${answer}\n${item.explanation[lang]}\n${item.prompt[lang]}`;
      if (!item.prompt[lang].trim() || !answer.trim()) return false;
      if (!numbersGrounded(claim, passage)) return false;
    }
    return true;
  });
}

export function parsePageBankItems(raw: unknown): PageBankItem[] {
  const list = Array.isArray(raw) ? raw : [];
  const items: PageBankItem[] = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const rec = row as Record<string, unknown>;
    const prompt = langBag(rec.prompt, true);
    const options = optionBag(rec.options);
    const explanation = langBag(rec.explanation, true);
    const evidenceQuote = String(rec.evidenceQuote ?? rec.evidence_quote ?? '').trim();
    const answerIndex = Number(rec.answerIndex ?? rec.answer_index);
    if (!prompt || !options || !explanation || !evidenceQuote || !Number.isInteger(answerIndex)) continue;
    items.push({ prompt, options, answerIndex, evidenceQuote, explanation });
  }
  return items;
}

/** Same instructions generatePageQuiz sends. The batch job must not drift from this text. */
export const PAGE_QUIZ_SYSTEM =
  'Return JSON {"questions":[{"prompt":{"en":"","uz":"","ru":""},"options":{"en":["","","",""],"uz":["","","",""],"ru":["","","",""]},"answerIndex":0,"evidenceQuote":"","explanation":{"en":"","uz":"","ru":""}}]}. Use ONLY the passage. evidenceQuote must be copied word for word. Exactly 4 options, exactly one correct, answerIndex 0-3. Every number you write must appear in the passage. Uzbek in Latin. Russian in Cyrillic.';

export const PAGE_QUIZ_USER_LEAD =
  'Write 8 questions about the story on this page. Ignore publisher advertisements, download offers and license text.';

export function pageQuizUserContent(passage: string, avoidQuotes: string[] = []): string {
  return [
    PAGE_QUIZ_USER_LEAD,
    avoidQuotes.filter(Boolean).length
      ? `Do not repeat these passages, which were already asked:\n${avoidQuotes.filter(Boolean).slice(0, 12).map((quote) => `- ${quote.slice(0, 180)}`).join('\n')}`
      : '',
    `Page:\n\n${passage}`,
  ].filter(Boolean).join('\n\n');
}

/** Eight grounded questions, each language present, answer index 0-3, quotes distinct and copied from the page. */
export function acceptPageQuiz(raw: unknown, passage: string): PageBankItem[] | null {
  const text = readingPassage(passage).slice(0, 4000);
  const items = groundPageItems(parsePageBankItems(raw), text);
  if (items.length !== 8) return null;
  const quotes = new Set(items.map((item) => foldSpace(item.evidenceQuote).toLowerCase()));
  if (quotes.size !== 8) return null;
  return items;
}
