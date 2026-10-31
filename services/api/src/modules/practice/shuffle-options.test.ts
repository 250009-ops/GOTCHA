import * as assert from 'node:assert/strict';
import { shuffle, shuffleQuestionOptions } from './shuffle-options';

// Deterministic PRNG (mulberry32) so the test is stable.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1. Same multiset, input untouched.
const src = ['correct', 'b', 'c', 'd'];
const out = shuffle(src, rng(1));
assert.deepEqual([...out].sort(), [...src].sort());
assert.deepEqual(src, ['correct', 'b', 'c', 'd']);

// 2. The correct answer's position varies, and is roughly uniform over 4000 quizzes.
const r = rng(42);
const counts = [0, 0, 0, 0];
for (let i = 0; i < 4000; i++) {
  const [q] = shuffleQuestionOptions([{ correctAnswer: 'correct', options: ['correct', 'b', 'c', 'd'] }], r);
  counts[q.options!.indexOf('correct')]++;
}
for (const c of counts) assert.ok(c > 850 && c < 1150, `position counts not uniform: ${counts}`);

// 3. Cloze / writing questions without options are left alone.
const [w] = shuffleQuestionOptions([{ correctAnswer: 'x', options: [] as string[] }], r);
assert.deepEqual(w.options, []);
console.log('shuffle-options: OK', counts.join('/'));
