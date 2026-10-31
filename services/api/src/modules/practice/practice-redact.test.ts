import * as assert from 'node:assert/strict';
import { redactSession } from './practice-redact';
import { shuffleQuestionOptions } from './shuffle-options';

const open = redactSession({ completedAt: null, questions: [{ id: 'q', prompt: 'p', options: ['a', 'b'], correctAnswer: 'a', explanation: 'x' }] });
assert.equal(JSON.stringify(open).includes('correctAnswer'), false);
assert.equal(JSON.stringify(open).includes('explanation'), false);
const done = redactSession({ completedAt: new Date(), questions: [{ id: 'q', correctAnswer: 'a', explanation: 'x' }] });
assert.equal((done.questions![0] as { correctAnswer: string }).correctAnswer, 'a');
// Correct answer is not stuck at option 1 across many shuffles.
const firsts = new Map<string, number>();
for (let i = 0; i < 2000; i++) {
  const [q] = shuffleQuestionOptions([{ options: ['right', 'w1', 'w2', 'w3'] }]);
  firsts.set(q.options![0], (firsts.get(q.options![0]) ?? 0) + 1);
}
for (const n of firsts.values()) assert.ok(n > 350 && n < 650, `skewed: ${[...firsts]}`);
console.log('practice redact + shuffle: OK');
