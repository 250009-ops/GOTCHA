import * as assert from 'node:assert/strict';
import { questionRefersToPage, uzbekApostrophesOk, validateDictEntry, validateQuizQuestion } from './content-gen';

const page = 'Anna found a red key on the old table and then opened the blue door before the heavy rain started outside.';

const question = {
  promptI18n: {
    en: 'Where was the key?',
    uz: 'Kalit qayerda edi?',
    ru: 'Где был ключ?',
  },
  optionsI18n: {
    en: ['on the old table', 'in the garden', 'under the bed', 'on the ship'],
    uz: ['eski stolda', 'bogʻda', 'karavot tagida', 'kemada'],
    ru: ['на старом столе', 'в саду', 'под кроватью', 'на корабле'],
  },
  answerIndex: 0,
  evidenceQuote: 'on the old table',
  explanationI18n: {
    en: 'The page says the key was on the old table.',
    uz: 'Sahifada kalit eski stolda edi.',
    ru: 'На странице ключ был на старом столе.',
  },
};

assert.equal(uzbekApostrophesOk('bogʻda'), true);
assert.equal(uzbekApostrophesOk("bog'da"), false);

const good = validateDictEntry({
  lemma: 'table',
  senses: {
    en: [{ meaning: 'a piece of furniture', pos: 'noun', example: 'The book is on the table.' }],
    uz: [{ meaning: 'stol', pos: 'noun' }],
    ru: [{ meaning: 'стол', pos: 'noun' }],
  },
});
assert.equal(good.ok, true);

const badUz = validateDictEntry({
  lemma: 'teacher',
  senses: {
    en: [{ meaning: 'a person who teaches', pos: 'noun' }],
    uz: [{ meaning: "o'qituvchi", pos: 'noun' }],
    ru: [{ meaning: 'учитель', pos: 'noun' }],
  },
});
assert.equal(badUz.ok, false);
if (!badUz.ok) assert.equal(badUz.reason, 'uzbek apostrophe');

const quiz = validateQuizQuestion(question, page, 'en');
assert.equal(quiz.ok, true, JSON.stringify(quiz));
assert.equal(questionRefersToPage(question, page, 'en'), true);

const offPage = validateQuizQuestion({
  ...question,
  optionsI18n: {
    ...question.optionsI18n,
    en: ['in the castle', 'in the garden', 'under the bed', 'on the ship'],
  },
}, page, 'en');
assert.equal(offPage.ok, false);
if (!offPage.ok) assert.equal(offPage.reason, 'options do not refer to the page');

const empty = validateQuizQuestion({
  ...question,
  promptI18n: { ...question.promptI18n, ru: '   ' },
}, page, 'en');
assert.equal(empty.ok, false);

console.log('content-gen tests passed');
