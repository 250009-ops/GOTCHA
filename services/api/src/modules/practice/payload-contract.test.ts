import * as assert from 'node:assert/strict';
import { buildCloze, seededRandom } from '@gotcha/shared';
import { buildPracticeItem } from './practice-items';

// PRD §4 AC7: production items never carry their answer.
const engine = { buildItem: buildPracticeItem as unknown as (...args: unknown[]) => Record<string, unknown> };
const vocab = {
  id: '11111111-1111-1111-1111-111111111111',
  lemma: 'serendipity',
  translation: 'счастливая случайность',
  contextSentence: 'It was pure serendipity that we met.',
  sourceLang: 'en',
  targetLang: 'ru',
  content: null,
};
const cloze = buildCloze(vocab.contextSentence, vocab.lemma);
for (const type of ['typed_recall', 'cloze', 'dictation'] as const) {
  const item = engine.buildItem(vocab, type, false, cloze, ['a', 'b', 'c'], seededRandom(1));
  const json = JSON.stringify(item).toLowerCase();
  assert.ok(!json.includes('serendipity'), `${type} payload leaks the answer: ${json}`);
}
const listen = engine.buildItem(vocab, 'listening_mcq', false, cloze, ['alpha', 'beta', 'gamma'], seededRandom(1));
assert.equal((listen.options as string[]).length, 4);
assert.equal(listen.hasAudio, true);
assert.equal('audioText' in listen, false);
console.log('payload-contract.test.ts ok');
