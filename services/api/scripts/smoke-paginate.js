const { paginateText, TARGET_SEGMENT_WORDS, MAX_SEGMENT_WORDS } = require('../dist/utils/tokenizer');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Short text stays one page (under MAX_SEGMENT_WORDS)
const short = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
assert(paginateText(short).length === 1, 'short should be 1 page');

// Long multi-paragraph text → multiple pages near target
const paras = [];
for (let i = 0; i < 10; i++) {
  paras.push(Array.from({ length: 40 }, (_, j) => `p${i}w${j}`).join(' '));
}
const multi = paginateText(paras.join('\n\n'));
assert(multi.length >= 3, `expected >=3 pages, got ${multi.length}`);
for (const c of multi) {
  assert(c.wordCount <= MAX_SEGMENT_WORDS, `page over max: ${c.wordCount}`);
}

// One huge paragraph of sentences → split near TARGET (~100)
const sentences = Array.from(
  { length: 80 },
  (_, i) => `This is sentence number ${i} with several extra filler words here.`,
).join(' ');
const fromSentences = paginateText(sentences);
assert(fromSentences.length >= 2, 'sentence blob should split');
const avg =
  fromSentences.reduce((s, c) => s + c.wordCount, 0) / fromSentences.length;
assert(avg <= MAX_SEGMENT_WORDS, 'avg over max');

console.log(
  JSON.stringify(
    {
      TARGET_SEGMENT_WORDS,
      MAX_SEGMENT_WORDS,
      multiPages: multi.length,
      multiWords: multi.map((c) => c.wordCount),
      sentencePages: fromSentences.length,
      sentenceWords: fromSentences.map((c) => c.wordCount),
      ok: true,
    },
    null,
    2,
  ),
);
