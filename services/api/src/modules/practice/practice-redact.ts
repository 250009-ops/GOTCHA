/**
 * W-24 / W-18: the client must never see the correct answer (or the explanation, which often gives it
 * away) before the user submits. Grading stays on the server (submitAnswers compares by text), options
 * are shuffled server-side (shuffle-options.ts). After completion the full session may be shown.
 */
export function redactQuestion<Q extends { correctAnswer?: unknown; explanation?: unknown }>(q: Q) {
  const { correctAnswer: _c, explanation: _e, ...rest } = q;
  return rest;
}

export function redactSession<S extends { completedAt?: Date | string | null; questions?: Array<{ correctAnswer?: unknown; explanation?: unknown }> }>(
  session: S,
): S {
  if (session.completedAt || !session.questions) return session;
  return { ...session, questions: session.questions.map(redactQuestion) } as S;
}
