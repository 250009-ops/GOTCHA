/**
 * Reproducible fixture: AI cleanup must keep PDF transcript wrap-ups.
 * Prefer source via ts-node so local stale dist cannot hide regressions.
 * Run from services/api: node scripts/verify-pdf-ending-cleanup.cjs
 */
const path = require('path');

require('ts-node/register/transpile-only');
const {
  applyCleanupSelection,
  mergeChapterCleanup,
  shouldKeepCleanedText,
  originalEndingPreserved,
  isProtectedLearningText,
  planImportCleanup,
  splitForImportAi,
  processCleanupChunk,
  buildCleanupUserPrompt,
} = require('../src/modules/imports/import-ai-cleanup');

const ENDING =
  'And finally, some respondents said that they would have liked more guidance on the best ' +
  'way to go about looking for a job, that the course could have done more to help them. ' +
  'Finally, we asked if there were any... That is the end of section four. You now have half a ' +
  'minute to check your answers.';

const BODY =
  ('The graduates highlighted teamwork and personal organization. '.repeat(220)) + ENDING;

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
    return false;
  }
  console.log('OK:', msg);
  return true;
}

assert(isProtectedLearningText(ENDING), 'wrap-up detected as protected learning text');

const chunks = splitForImportAi(BODY, 10000);
assert(chunks.length >= 2, 'multi-chunk body (got ' + chunks.length + ')');
assert(/half a minute/i.test(chunks[chunks.length - 1]), 'last chunk contains wrap-up');

// A: dropChapter on trailing chunk only — must keep ending
const droppedTail = chunks.map((c, i) =>
  i === chunks.length - 1
    ? { text: '', dropChapter: true }
    : { text: c, dropChapter: false },
);
const mergedA = mergeChapterCleanup({ title: 'Pages 1-6', text: BODY }, droppedTail, chunks, '');
assert(!!mergedA, 'merge returns chapter');
assert(/looking for a job/i.test(mergedA.text), 'partial dropChapter keeps ending body');
assert(/half a minute/i.test(mergedA.text.replace(/\s+/g, ' ')), 'partial dropChapter keeps wrap-up');

// B: dropChapter via applyCleanupSelection on last chunk with wrap-up — fail-open keep
const dropApplied = applyCleanupSelection(chunks[chunks.length - 1], {
  removeBlocks: [],
  removeSnippets: [],
  dropChapter: true,
  title: '',
});
assert(dropApplied.dropChapter === false, 'apply ignores dropChapter on learner chunk');
assert(/check your answers/i.test(dropApplied.text), 'apply keeps wrap-up after ignored drop');

// C: removeBlocks targeting wrap-up block — blocked locally
const last = chunks[chunks.length - 1];
const lastBlocks = last.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
const wrapIdx = lastBlocks.findIndex((b) => /end of section|check your answers/i.test(b));
assert(wrapIdx >= 0, 'last chunk has wrap-up block');
const wiped = applyCleanupSelection(last, {
  removeBlocks: lastBlocks.map((_, i) => i + 1),
  removeSnippets: [],
  dropChapter: false,
  title: '',
});
assert(/check your answers/i.test(wiped.text), 'protected wrap-up block not removed');

// D: processCleanupChunk with aggressive JSON
const processed = processCleanupChunk(last, JSON.stringify({
  removeBlocks: [wrapIdx + 1],
  removeSnippets: ['That is the end of section four. You now have half a minute to check your answers.'],
  dropChapter: false,
  title: '',
}));
assert(processed && /check your answers/i.test(processed.text), 'snippet+block attack keeps wrap-up');

// E: ending fingerprint
const truncated = BODY.slice(0, BODY.indexOf('And finally'));
assert(shouldKeepCleanedText(BODY, truncated) === false, 'shouldKeep rejects lost ending');
assert(originalEndingPreserved(BODY, truncated) === false, 'ending probe detects truncation');
assert(originalEndingPreserved(BODY, BODY) === true, 'ending probe accepts full text');

// F: final-chunk prompt reminder
const prompt = buildCleanupUserPrompt({
  source: 'pdf',
  documentTitle: 'Transcription fixture',
  chapterTitle: 'Pages 1-6',
  chunkIndex: 1,
  chunkTotal: 2,
  text: last,
});
assert(/FINAL CHUNK/i.test(prompt), 'user prompt marks final chunk');
assert(/check your answers/i.test(prompt), 'user prompt includes wrap-up text');

const plan = planImportCleanup([{ title: 'c', text: BODY }]);
assert(plan[0] && typeof plan[0].remainder === 'string', 'plan includes remainder field');

if (process.exitCode) {
  console.error('VERIFY_PDF_ENDING_CLEANUP failed');
  process.exit(1);
}
console.log('VERIFY_PDF_ENDING_CLEANUP passed');