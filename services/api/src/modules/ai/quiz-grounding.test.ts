import * as assert from 'node:assert/strict';
import { groundPageItems, groundQuizQuestions, parsePageBankItems, type PageBankItem } from './quiz-grounding';

const passage = 'In 1917 the street was quiet. He stood still in hesitation at the door.';

const mcq = (answer: string, explanation = 'The street was quiet in 1917.') => ({
  prompt: 'When was the street quiet?',
  options: [answer, 'Yesterday', 'At noon', 'Last winter'],
  correctAnswer: answer,
  explanation,
  evidenceQuote: 'In 1917 the street was quiet.',
});

assert.equal(groundQuizQuestions([mcq('1917')], passage, { requireOptions: true, requireEvidence: true }).length, 1);
assert.equal(groundQuizQuestions([mcq('1717')], passage, { requireOptions: true }).length, 0, '1717 is not in the passage');
assert.equal(groundQuizQuestions([{ ...mcq('1917'), options: ['1917', 'Yesterday'] }], passage, { requireOptions: true }).length, 0, 'fewer than 4 options');
assert.equal(groundQuizQuestions([{ ...mcq('1917'), options: ['1917', '1917', 'Yesterday', 'At noon'] }], passage, { requireOptions: true }).length, 0, 'duplicate options');
assert.equal(
  groundQuizQuestions([{ prompt: 'He stood in ___ at the door.', correctAnswer: 'hesitation', options: [] }], passage, { cloze: true }).length,
  1,
);
assert.equal(
  groundQuizQuestions([{ prompt: 'He stood in ___ at the door.', correctAnswer: 'victory', options: [] }], passage, { cloze: true }).length,
  0,
);

const pageItem: PageBankItem = {
  prompt: { en: 'When?', uz: 'Qachon?', ru: 'Когда?' },
  options: {
    en: ['1917', 'Yesterday', 'At noon', 'Last winter'],
    uz: ['1917', 'Kecha', 'Tushda', 'Oʻtgan qish'],
    ru: ['1917', 'Вчера', 'В полдень', 'Прошлой зимой'],
  },
  answerIndex: 0,
  evidenceQuote: 'In 1917 the street was quiet.',
  explanation: { en: 'The text says 1917.', uz: 'Matnda 1917 deyilgan.', ru: 'В тексте 1917.' },
};
assert.equal(groundPageItems([pageItem], passage).length, 1);
assert.equal(groundPageItems([{ ...pageItem, evidenceQuote: 'a short' }], passage).length, 0);
assert.equal(groundPageItems([{ ...pageItem, options: { ...pageItem.options, en: ['1717', 'Yesterday', 'At noon', 'Last winter'] } }], passage).length, 0);

const parsed = parsePageBankItems([pageItem]);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].options.uz[2], 'Tushda');

console.log('quiz-grounding: OK');
