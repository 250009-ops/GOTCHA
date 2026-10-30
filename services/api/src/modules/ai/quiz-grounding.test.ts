import * as assert from 'node:assert/strict';
import { groundQuizQuestions, numbersGrounded, numbersIn } from './quiz-grounding';

const passage = 'Es war im Oktober Anno 17, der großen Weihnachtsflut von 1717 folgte ein harter Winter.';

assert.deepEqual([...numbersIn('In 1,717 and 17 and 2026')].sort(), ['1717', '17', '2026'].sort());
assert.equal(numbersGrounded("'Anno 17' refers to 1717.", passage), true);
assert.equal(numbersGrounded("'Anno 17' 1917-yil degani.", passage), false);

const out = groundQuizQuestions(
  [
    {
      prompt: 'Qaysi yil haqida gap ketmoqda?',
      options: ['1717', '1917', '1817', '2017'],
      correctAnswer: '1717',
      explanation: "'Anno 17' 1917-yil degani.",
    },
    { prompt: 'Bad key', options: ['a', 'b'], correctAnswer: 'c', explanation: 'x' },
    { prompt: 'Invented year', options: ['1917', '1817'], correctAnswer: '1917' },
    { prompt: '', correctAnswer: 'x' },
    'junk',
  ],
  passage,
  { requireOptions: true },
);
assert.equal(out.length, 1);
assert.equal(out[0].correctAnswer, '1717');
assert.equal(out[0].explanation, undefined, 'ungrounded explanation is dropped');

const cloze = groundQuizQuestions(
  [{ prompt: 'Der große ___ von 1717', correctAnswer: 'Weihnachtsflut', explanation: 'The flood of 1717.' }],
  passage,
  { requireOptions: false },
);
assert.equal(cloze.length, 1);
assert.equal(cloze[0].explanation, 'The flood of 1717.');
console.log('quiz-grounding ok');
