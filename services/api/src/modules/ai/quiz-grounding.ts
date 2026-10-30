/**
 * UI-20: deterministic post-check for AI quiz questions.
 *
 * The model is asked to use only facts stated in the passage (temperature 0), but explanations can
 * still invent specifics (e.g. "'Anno 17' = 1917" for a 1717 story). This check keeps a question
 * only when it is well formed, and drops an explanation that cites a number the passage never
 * mentions, because a wrong explanation is worse than none.
 */
export interface QuizQuestionDraft {
  prompt: string;
  options?: string[];
  correctAnswer: string;
  explanation?: string;
}

/**
 * Numbers that appear in text: years, counts, decimals. Only a real thousands group ("1,717") is
 * joined; "1717, 3" or "3 4" stay separate numbers (PS-01). Decimals keep their point ("2.50").
 */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?<![\d.,])\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)|\d+(?:\.\d+)?/g)) {
    const n = m[0].replace(/,/g, '').replace(/^0+(?=\d)/, '');
    if (n) out.add(n);
  }
  return out;
}

/** PS-02: refuse to start a quiz session when grounding left no usable question. */
export function assertQuizHasQuestions<T>(questions: T[]): T[] {
  if (!questions.length) throw new QuizUnavailableError();
  return questions;
}

export class QuizUnavailableError extends Error {
  constructor() {
    super('Could not build a quiz for this passage. Please try another chapter.');
  }
}

/** True when every number cited in [claim] also appears in [passage] (or in the question itself). */
export function numbersGrounded(claim: string, passage: string, extra = ''): boolean {
  const allowed = new Set([...numbersIn(passage), ...numbersIn(extra)]);
  for (const n of numbersIn(claim)) {
    if (!allowed.has(n)) return false;
  }
  return true;
}

export function groundQuizQuestions(
  raw: unknown,
  passage: string,
  opts: { requireOptions: boolean },
): QuizQuestionDraft[] {
  if (!Array.isArray(raw)) return [];
  const out: QuizQuestionDraft[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const q = item as Record<string, unknown>;
    const prompt = typeof q.prompt === 'string' ? q.prompt.trim() : '';
    const correctAnswer = typeof q.correctAnswer === 'string' ? q.correctAnswer.trim() : '';
    if (!prompt || !correctAnswer) continue;
    const options = Array.isArray(q.options)
      ? q.options.filter((o): o is string => typeof o === 'string' && o.trim().length > 0).map((o) => o.trim())
      : [];
    if (opts.requireOptions) {
      // MCQ: the keyed answer must be one of the options, otherwise the grading is wrong.
      if (options.length < 2 || !options.includes(correctAnswer)) continue;
    }
    // Distractor options must not ground an explanation (they are wrong by design). Before PS-01 the
    // glued-number regex hid this, because "1717 1917" became a single number.
    const questionText = [prompt, correctAnswer].join(' ');
    // A correct answer that cites a number absent from the passage is not grounded: drop the question.
    if (!numbersGrounded(correctAnswer, passage, prompt)) continue;
    let explanation = typeof q.explanation === 'string' ? q.explanation.trim() : undefined;
    if (explanation && !numbersGrounded(explanation, passage, questionText)) explanation = undefined;
    out.push({ prompt, options: options.length ? options : undefined, correctAnswer, explanation });
  }
  return out;
}
