import * as assert from 'node:assert/strict';
import { paginateText, MAX_SEGMENT_WORDS, TARGET_SEGMENT_WORDS } from './tokenizer';

const short = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
assert.equal(paginateText(short).length, 1);

const paras = [];
for (let i = 0; i < 10; i++) {
  paras.push(Array.from({ length: 40 }, (_, j) => `p${i}w${j}`).join(' '));
}
const multi = paginateText(paras.join('\n\n'));
assert.ok(multi.length >= 3, `expected >=3 pages, got ${multi.length}`);
for (const c of multi) {
  assert.ok(c.wordCount <= MAX_SEGMENT_WORDS, `page over max: ${c.wordCount}`);
}

const turns = Array.from(
  { length: 40 },
  (_, i) => `‘This is spoken turn number ${i} with extra filler words here,’ I said.`,
);
const paged = paginateText(turns.join('\n'));
assert.ok(paged.length >= 2, `expected multiple dialogue pages, got ${paged.length}`);
for (const page of paged) {
  assert.ok(page.wordCount <= MAX_SEGMENT_WORDS, `dialogue page over max: ${page.wordCount}`);
  assert.equal(page.plainText.includes('\n\n'), false, page.plainText.slice(0, 80));
  for (const line of page.plainText.split('\n').filter((l) => l.trim())) {
    assert.match(line, /^‘This is spoken turn/);
  }
}

const smashed = paginateText(
  `‘Hello?’ ‘Who is it?’ ‘It’s me, Lenny.’ ${Array.from({ length: 90 }, (_, i) => `n${i}`).join(' ')}`,
);
assert.ok(smashed[0]!.plainText.includes('‘Hello?’\n‘Who is it?’\n‘It’s me, Lenny.’'));

console.log(
  JSON.stringify({
    TARGET_SEGMENT_WORDS,
    MAX_SEGMENT_WORDS,
    multiPages: multi.length,
    dialoguePages: paged.length,
    dialogueWords: paged.map((c) => c.wordCount),
    ok: true,
  }),
);
