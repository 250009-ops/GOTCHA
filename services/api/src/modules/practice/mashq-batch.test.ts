import * as assert from 'node:assert/strict';
import { acceptPageQuiz } from '../ai/quiz-grounding';
import { MASHQ_BATCH_BUDGET_USD, projectMashqBatchUsd, projectPageQuizUsd } from './mashq-batch';

const passage = 'Anna found a red key on the old table and then opened the blue door before the heavy rain started outside.';
const bag = (en: string, uz: string, ru: string) => ({ en, uz, ru });
const item = (quote: string) => ({
  prompt: bag('What happened on this page?', 'Bu sahifada nima boʻldi?', 'Что произошло на странице?'),
  options: {
    en: ['alpha', 'bravo', 'charlie', 'delta'],
    uz: ['olma', 'nok', 'uzum', 'anor'],
    ru: ['яблоко', 'груша', 'виноград', 'гранат'],
  },
  answerIndex: 0,
  evidenceQuote: quote,
  explanation: bag('It is written on the page.', 'Bu sahifada yozilgan.', 'Это написано на странице.'),
});

const eight = [
  item('Anna found a red key'),
  item('on the old table'),
  item('opened the blue door'),
  item('before the heavy rain'),
  item('the old table and then'),
  item('the blue door before'),
  item('the heavy rain started'),
  item('started outside'),
];

assert.equal(acceptPageQuiz(eight, passage)?.length, 8);
assert.equal(acceptPageQuiz(eight.slice(0, 5), passage)?.length, 5);
assert.equal(acceptPageQuiz(eight.slice(0, 4), passage), null);
assert.equal(acceptPageQuiz(eight.map((row, index) => (index === 1 ? { ...row, answerIndex: 9 } : row)), passage)?.length, 7);
assert.equal(acceptPageQuiz(eight.map((row, index) => (index < 4 ? { ...row, answerIndex: 9 } : row)), passage), null);

const one = projectPageQuizUsd(518);
const all = projectMashqBatchUsd(Array.from({ length: 17634 }, () => 518));
assert.ok(one > 0 && one < 0.01, `per page ${one}`);
console.log(JSON.stringify({ perPageUsd: Number(one.toFixed(6)), requests: all.requests, projectionUsd: all.usd, budgetUsd: MASHQ_BATCH_BUDGET_USD, withinBudget: all.usd <= MASHQ_BATCH_BUDGET_USD }));
if (all.usd > MASHQ_BATCH_BUDGET_USD) {
  console.error('projection is over the $40 cap');
  process.exit(2);
}
console.log('mashq-batch.test.ts ok');
