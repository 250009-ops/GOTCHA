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

/** Numbers that appear in text: digit runs (years, counts), normalised without separators. */
export function numbersIn(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(/\d[\d\s.,]*\d|\d/g)) {
    const n = m[0].replace(/[\s.,]/g, '');
    if (n) out.add(n.replace(/^0+(?=\d)/, ''));
  }
  return out;
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
    const questionText = [prompt, correctAnswer, ...options].join(' ');
    // A correct answer that cites a number absent from the passage is not grounded: drop the question.
    if (!numbersGrounded(correctAnswer, passage, prompt)) continue;
    let explanation = typeof q.explanation === 'string' ? q.explanation.trim() : undefined;
    if (explanation && !numbersGrounded(explanation, passage, questionText)) explanation = undefined;
    out.push({ prompt, options: options.length ? options : undefined, correctAnswer, explanation });
  }
  return out;
}
