import * as assert from 'node:assert/strict';
import { gradeAnswer, normalize, uzCyrToLat, damerauLevenshtein, charDiff } from '@gotcha/shared';

type Case = [input: string, expected: string, lang: string, verdict: 'correct' | 'almost' | 'wrong', opts?: { variants?: string[]; knownWords?: string[] }];

// PRD-practice.md §4.1 acceptance criteria + native-speaker style fixtures (EN / RU / UZ).
const CASES: Case[] = [
  // AC1 case + punctuation
  ['Writing.', 'writing', 'en', 'correct'],
  ['  WRITING  ', 'writing', 'en', 'correct'],
  ['writing!', 'writing', 'en', 'correct'],
  ['"writing"', 'writing', 'en', 'correct'],
  // AC2 typo allowance by length
  ['wrting', 'writing', 'en', 'almost'],
  ['wrtng', 'writing', 'en', 'wrong'],
  ['wirting', 'writing', 'en', 'almost'], // transposition = 1 (Damerau)
  ['cat', 'cat', 'en', 'correct'],
  ['cot', 'cat', 'en', 'wrong'], // ≤3 chars: no typos
  ['hous', 'house', 'en', 'almost'],
  ['huose', 'house', 'en', 'almost'],
  ['hosue', 'house', 'en', 'almost'],
  ['houses', 'house', 'en', 'almost'],
  ['mouse', 'house', 'en', 'almost'],
  ['beautifull', 'beautiful', 'en', 'almost'],
  ['beatiful', 'beautiful', 'en', 'almost'],
  ['butiful', 'beautiful', 'en', 'almost'], // 2 edits allowed at length ≥8
  ['bewtfl', 'beautiful', 'en', 'wrong'],
  ['enviroment', 'environment', 'en', 'almost'],
  ['envirment', 'environment', 'en', 'almost'],
  ['envrmnt', 'environment', 'en', 'wrong'],
  ['necesary', 'necessary', 'en', 'almost'],
  ['', 'writing', 'en', 'wrong'],
  ['   ', 'writing', 'en', 'wrong'],
  // English optional articles / infinitive "to"
  ['to run', 'run', 'en', 'correct'],
  ['run', 'to run', 'en', 'correct'],
  ['the house', 'house', 'en', 'correct'],
  ['a book', 'book', 'en', 'correct'],
  ['an apple', 'apple', 'en', 'correct'],
  // variants
  ['sprint', 'run, sprint', 'en', 'correct'],
  ['dash', 'run / dash', 'en', 'correct'],
  ['look after', 'look after (someone)', 'en', 'correct'],
  ['take care', 'look after', 'en', 'correct', { variants: ['take care'] }],
  // multi-word: ≤1 typo per word
  ['look aftr', 'look after', 'en', 'almost'],
  ['lok aftr', 'look after', 'en', 'almost'],
  ['lk aftr', 'look after', 'en', 'wrong'],
  ['give up', 'give up', 'en', 'correct'],
  ['gave up', 'give up', 'en', 'almost'],
  ['give uq', 'give up', 'en', 'wrong'], // 2-letter word: no typo allowed
  // real-word typo exception
  ['life', 'live', 'en', 'wrong', { knownWords: ['life'] }],
  ['life', 'live', 'en', 'almost'],
  ['form', 'from', 'en', 'wrong', { knownWords: ['form'] }],
  // AC3 Russian ё/е, stress marks, case
  ['ёлка', 'елка', 'ru', 'correct'],
  ['елка', 'ёлка', 'ru', 'correct'],
  ['ЁЛКА', 'ёлка', 'ru', 'correct'],
  ['за\u0301мок', 'замок', 'ru', 'correct'], // combining stress mark
  ['привет', 'привет', 'ru', 'correct'],
  ['Привет!', 'привет', 'ru', 'correct'],
  ['превет', 'привет', 'ru', 'almost'],
  ['пока', 'привет', 'ru', 'wrong'],
  ['здраствуйте', 'здравствуйте', 'ru', 'almost'],
  ['здрасте', 'здравствуйте', 'ru', 'wrong'],
  ['учитель', 'учитель', 'ru', 'correct'],
  ['учитиль', 'учитель', 'ru', 'almost'],
  // AC5 Latin for a Russian target
  ['privet', 'привет', 'ru', 'wrong'],
  ['uchitel', 'учитель', 'ru', 'wrong'],
  // AC4 Uzbek apostrophes & scripts
  ["o'qituvchi", 'oʻqituvchi', 'uz', 'correct'],
  ['o‘qituvchi', 'oʻqituvchi', 'uz', 'correct'],
  ['o`qituvchi', 'oʻqituvchi', 'uz', 'correct'],
  ['oʼqituvchi', 'oʻqituvchi', 'uz', 'correct'],
  ['ўқитувчи', 'oʻqituvchi', 'uz', 'correct'],
  ['oqituvchi', 'oʻqituvchi', 'uz', 'almost'],
  ['oʻqituvchi', 'ўқитувчи', 'uz', 'correct'],
  ["g'isht", 'gʻisht', 'uz', 'correct'],
  ['ғишт', 'gʻisht', 'uz', 'correct'],
  ['gisht', 'gʻisht', 'uz', 'almost'],
  ['шаҳар', 'shahar', 'uz', 'correct'],
  ['shaxar', 'shahar', 'uz', 'almost'],
  ['чиройли', 'chiroyli', 'uz', 'correct'],
  ['ер', 'yer', 'uz', 'correct'],
  ['келди', 'keldi', 'uz', 'correct'],
  ['юлдуз', 'yulduz', 'uz', 'correct'],
  ['яхши', 'yaxshi', 'uz', 'correct'],
  ['qalam', 'қалам', 'uz', 'correct'],
  ['kalam', 'qalam', 'uz', 'almost'],
  ["san'at", 'sanʼat', 'uz', 'correct'],
  ['санъат', 'sanʼat', 'uz', 'correct'],
  ['kitob', 'kitob', 'uz', 'correct'],
  ['kitop', 'kitob', 'uz', 'almost'],
  ['daftar', 'kitob', 'uz', 'wrong'],
];

let failed = 0;
for (const [input, expected, lang, verdict, opts] of CASES) {
  const r = gradeAnswer(input, expected, { lang, ...opts });
  if (r.verdict !== verdict) {
    failed++;
    console.error(`FAIL grade(${JSON.stringify(input)}, ${JSON.stringify(expected)}, ${lang}) = ${r.verdict} (${r.reason ?? '-'}), want ${verdict}`);
  }
}
assert.equal(failed, 0, `${failed} grading fixtures failed`);
assert.ok(CASES.length >= 60, 'PRD AC6 needs ≥60 fixtures');

// Reasons / feedback
assert.equal(gradeAnswer('privet', 'привет', { lang: 'ru' }).reason, 'wrong_script');
assert.equal(gradeAnswer('oqituvchi', 'oʻqituvchi', { lang: 'uz' }).reason, 'uz_apostrophe');
assert.equal(gradeAnswer('wrting', 'writing', { lang: 'en' }).reason, 'typo');
assert.deepEqual(
  charDiff('wrting', 'writing').map((p) => p.op),
  ['same', 'add', 'same'],
);

// Helpers
assert.equal(damerauLevenshtein('ab', 'ba'), 1);
assert.equal(damerauLevenshtein('kitten', 'sitting'), 3);
assert.equal(uzCyrToLat('ўзбекистон'), 'oʻzbekiston');
assert.equal(uzCyrToLat('ер'), 'yer');
assert.equal(uzCyrToLat('келди'), 'keldi');
assert.equal(normalize('  Ёж, ёлка! '), 'еж елка');

console.log(`grading.test.ts ok (${CASES.length} fixtures)`);
