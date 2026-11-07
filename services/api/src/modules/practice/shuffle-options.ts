/**
 * Tester P0: the model nearly always puts the correct answer first, so "option 1" was always right.
 * Fisher–Yates shuffle of each question's options (server-side, before the session is stored).
 * correctAnswer is compared by text, so grading is unaffected.
 */
export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function shuffleQuestionOptions<Q extends { options?: string[] | null }>(questions: Q[], rng: Rng = Math.random): Q[] {
  return questions.map((q) => (Array.isArray(q.options) && q.options.length > 1 ? { ...q, options: shuffle(q.options, rng) } : q));
}

/**
 * Mashq stores the correct option at answerIndex. Serving shuffles that list and
 * keeps the correct text, so a file that always puts the answer first is still fair.
 */
export function shuffleAnswerOptions(
  options: readonly string[],
  answerIndex: number,
  rng: Rng = Math.random,
): { options: string[]; answerIndex: number; correctAnswer: string } {
  const correctAnswer = String(options[answerIndex] ?? '');
  const next = options.length > 1 ? shuffle(options, rng) : options.slice();
  const at = next.indexOf(correctAnswer);
  return { options: next, answerIndex: at < 0 ? 0 : at, correctAnswer };
}
