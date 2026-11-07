import * as assert from 'node:assert/strict';
import { questionRefersToPage, uzbekApostrophesOk, validateDictEntry, validateMashqFile, validateQuizQuestion } from './content-gen';

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
  surface: 'eyes',
  lemma: 'eye',
  senses: {
    uz: [{ meaning: 'koʻzlar', pos: 'noun' }],
    ru: [{ meaning: 'глаза', pos: 'noun' }],
  },
}, 'en');
assert.equal(good.ok, true);
if (good.ok) assert.equal(good.entry.headword, 'eye');

const sameLang = validateDictEntry({
  surface: 'table',
  lemma: 'table',
  senses: {
    en: [{ meaning: 'a piece of furniture', pos: 'noun' }],
    uz: [{ meaning: 'stol', pos: 'noun' }],
    ru: [{ meaning: 'стол', pos: 'noun' }],
  },
}, 'en');
assert.equal(sameLang.ok, false);
if (!sameLang.ok) assert.equal(sameLang.reason, 'same-language target');

const badUz = validateDictEntry({
  surface: 'teacher',
  lemma: 'teacher',
  senses: {
    uz: [{ meaning: "o'qituvchi", pos: 'noun' }],
    ru: [{ meaning: 'учитель', pos: 'noun' }],
  },
}, 'en');
assert.equal(badUz.ok, false);
if (!badUz.ok) assert.equal(badUz.reason, 'uzbek apostrophe');

const pages = new Map([
  ['seg-1', { id: 'seg-1', text: page, sourceLang: 'en', contentId: 'book-1', segmentIndex: 4 }],
]);
const placed = validateMashqFile({
  contentId: 'book-1',
  pages: [{ segmentId: 'seg-1', contentId: 'book-1', segmentIndex: 4, questions: [question, question, question, question, question] }],
}, pages);
assert.equal(placed.ok.length, 1, JSON.stringify(placed.rejected));
const wrongIndex = validateMashqFile({
  contentId: 'book-1',
  pages: [{ segmentId: 'seg-1', contentId: 'book-1', segmentIndex: 0, questions: [question, question, question, question, question] }],
}, pages);
assert.equal(wrongIndex.ok.length, 0);
assert.equal(wrongIndex.rejected[0]?.reason, 'unknown segment');

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
