import * as assert from 'node:assert/strict';
import {
  looksLikeTitleLine,
  splitAccurateChapters,
  splitByOutlineTitles,
  stripGutenbergBoilerplate,
} from './chapter-split';
import {
  parseGutenbergId,
  gutenbergAlephPath,
  gutenbergHtmlBookUrls,
  gutenbergPlainTextUrls,
  isGutenbergIllustratedHtmlUrl,
  looksLikeGutenbergLandingPage,
} from './gutenberg';

function titles(text: string, fallback = 'Moby Dick') {
  return splitAccurateChapters(text, fallback).map((c) => c.title);
}

const moby = `
*** START OF THE PROJECT GUTENBERG EBOOK MOBY-DICK; OR, THE WHALE ***

MOBY-DICK; or, THE WHALE.

CONTENTS

ETYMOLOGY.

EXTRACTS.

CHAPTER 1. Loomings.

CHAPTER 2. The Carpet-Bag.

CHAPTER 3. The Spouter-Inn.

CHAPTER 135. The Chase.—Third Day.

Epilogue

ETYMOLOGY.

(Supplied by a Late Consumptive Usher to a Grammar School.)

The pale Usher—threadbare in coat, heart, body, and brain; I see him now.

EXTRACTS. (Supplied by a Sub-Sub-Librarian).

It will be seen that this mere painstaking burrower and grub-worm of a
poor devil of a Sub-Sub.

CHAPTER 1. Loomings.

Call me Ishmael. Some years ago—never mind how long precisely—having
little or no money in my purse, and nothing particular to interest me on
shore, I thought I would sail about a little and see the watery part of
the world.

I am something of a salt, do I ever go to sea as a Commodore, or a
Captain, or a Cook. I confess there is considerable glory in that.

CHAPTER 2. The Carpet-Bag.

I stuffed a shirt or two into my old carpet-bag, tucked it under my arm,
and started for Cape Horn and the Pacific.

CHAPTER 3. The Spouter-Inn.

Entering that gable-ended Spouter-Inn, you found yourself in a wide
entrance.

CHAPTER 135. The Chase.—Third Day.

The birds! the birds! On the second day, a sail drew near.

Epilogue

The drama's done. Why then here does any one step forth? Because one did
survive the wreck.

It was the devious-cruising Rachel, that in her retracing search after her
missing children, only found another orphan.

*** END OF THE PROJECT GUTENBERG EBOOK MOBY-DICK; OR, THE WHALE ***
`;

const got = splitAccurateChapters(moby, 'Moby Dick');
assert.equal(
  got.map((c) => c.title).join(' | '),
  [
    'Etymology',
    'Extracts (Supplied by a Sub-Sub-Librarian).',
    'Chapter 1. Loomings.',
    'Chapter 2. The Carpet-Bag.',
    'Chapter 3. The Spouter-Inn.',
    'Chapter 135. The Chase.—Third Day.',
    'Epilogue',
  ].join(' | '),
);
assert.match(got[2].text, /Call me Ishmael/);
assert.match(got[2].text, /I am something of a salt/);
assert.equal(got.some((c) => /contents/i.test(c.title)), false);
assert.equal(got.some((c) => /CHAPTER 10\. A Bosom Friend/.test(c.text) && /Call me Ishmael/.test(c.text)), false);
assert.doesNotMatch(got.map((c) => c.title).join('\n'), /I am something/);
assert.doesNotMatch(got.map((c) => c.title).join('\n'), /I stuffed a shirt/);
assert.match(got[got.length - 1].text, /devious-cruising Rachel/);

const twoLine = splitAccurateChapters(
  `CHAPTER 4\nThe Counterpane\n\nUpon waking next morning about daylight, I found Queequeg's arm thrown over me.`,
  'Book',
);
assert.equal(twoLine[0].title, 'Chapter 4. The Counterpane');
assert.match(twoLine[0].text, /Upon waking/);

const roman = splitAccurateChapters(
  `II.\nThe Carpet-Bag\n\nI stuffed a shirt or two into my old carpet-bag.\n\nIII.\nThe Spouter-Inn\n\nEntering that gable-ended inn.`,
  'Book',
);
assert.equal(roman[0].title, 'Chapter II. The Carpet-Bag');
assert.equal(roman[1].title, 'Chapter III. The Spouter-Inn');

const firstPerson = splitAccurateChapters(
  `Call me Ishmael.\nI am something of a salt, do I ever go to sea as a Commodore, or a\nCaptain.\nI stuffed a shirt or two into my old carpet-bag, tucked it under my arm,`,
  'Moby Dick',
);
assert.equal(firstPerson.length, 1);
assert.equal(firstPerson[0].title, 'Moby Dick');

assert.equal(looksLikeTitleLine('Loomings.'), true);
assert.equal(looksLikeTitleLine('I am something of a salt, do I ever go to sea as a Commodore, or a'), false);

const merged = splitAccurateChapters(
  `CHAPTER 1. Loomings. Call me Ishmael. Some years ago I thought I would sail.\n\nCHAPTER 2. The Carpet-Bag. I stuffed a shirt or two into my old carpet-bag.`,
  'Book',
);
assert.equal(merged[0].title, 'Chapter 1. Loomings.');
assert.match(merged[0].text, /^Call me Ishmael/);
assert.equal(merged[1].title, 'Chapter 2. The Carpet-Bag.');

const cetology = splitAccurateChapters(
  `CHAPTER 31. Queen Mab.\n\nNext morning Stubb accosted Flask.\n\nCHAPTER 32. Cetology.\n\nAlready we are boldly launched upon the deep.\nCHAPTER I. (_Folio_), CHAPTER II. (_Right Whale_).—This whale among the English.\n\nCHAPTER 33. The Specksnyder.\n\nConcerning the officers of the whale-craft.`,
  'Book',
);
assert.deepEqual(
  cetology.map((c) => c.title),
  ['Chapter 31. Queen Mab.', 'Chapter 32. Cetology.', 'Chapter 33. The Specksnyder.'],
);
assert.match(cetology[1].text, /Folio/);

const uz = titles(`1-bob. Kirish\n\nBu kitob haqida.\n\n2-bob. Dengiz\n\nKemada ishladik.`);
assert.equal(uz[0], '1-bob. Kirish');
assert.equal(uz[1], '2-bob. Dengiz');

const md = titles(`## Chapter 1. Loomings\n\nCall me Ishmael.\n\n## Chapter 2. The Carpet-Bag\n\nI stuffed a shirt.`);
assert.equal(md[0], 'Chapter 1. Loomings');
assert.equal(md[1], 'Chapter 2. The Carpet-Bag');

const stripped = stripGutenbergBoilerplate(
  `license junk\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\nHello book\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nmore junk`,
);
assert.equal(stripped.includes('Hello book'), true);
assert.equal(stripped.includes('license junk'), false);
assert.equal(stripped.includes('more junk'), false);

const outlined = splitByOutlineTitles(
  `Cover page\n\nLoomings\nCall me Ishmael and then some more words here to fill the chapter body out properly.\n\nThe Carpet-Bag\nI stuffed a shirt or two into my old carpet-bag and walked toward the sea.`,
  ['Loomings', 'The Carpet-Bag'],
);
assert.ok(outlined);
assert.equal(outlined![0].title, 'Loomings');
assert.equal(outlined![1].title, 'The Carpet-Bag');

assert.equal(parseGutenbergId('https://www.gutenberg.org/cache/epub/2701/pg2701-images.html'), '2701');
assert.equal(parseGutenbergId('https://www.gutenberg.org/ebooks/2701'), '2701');
assert.equal(parseGutenbergId('https://www.gutenberg.org/files/2701/2701-0.txt'), '2701');
assert.equal(
  parseGutenbergId('https://www.gutenberg.org/cache/epub/65238/pg65238-images.html'),
  '65238',
);
const pg65238Txt = gutenbergPlainTextUrls('65238');
assert.ok(pg65238Txt[0].includes('65238-0.txt'));
assert.ok(pg65238Txt.some((u) => u.includes('pg65238.txt')));
assert.ok(gutenbergPlainTextUrls('2701')[0].includes('2701-0.txt'));
assert.equal(gutenbergAlephPath('2701'), '2/7/0/2701');
const htmlUrls = gutenbergHtmlBookUrls('65238');
assert.ok(htmlUrls.some((u) => /pg65238\.html$/i.test(u)), 'compact pg{id}.html should be in the HTML fallback list');
assert.ok(
  htmlUrls.every((u) => !/images\.html|html\.images/i.test(u)),
  'illustrated HTML must never be fetched (OOM / 502)',
);
assert.equal(
  isGutenbergIllustratedHtmlUrl('https://www.gutenberg.org/cache/epub/65238/pg65238-images.html'),
  true,
);
assert.equal(
  isGutenbergIllustratedHtmlUrl('https://www.gutenberg.org/cache/epub/65238/pg65238.html'),
  false,
);
assert.ok(gutenbergHtmlBookUrls('2701').some((u) => u.includes('2701-h.htm')));
assert.equal(
  looksLikeGutenbergLandingPage('Download This eBook Plain Text UTF-8 bibrec', 400),
  true,
);
assert.equal(looksLikeGutenbergLandingPage('CHAPTER 1. Loomings. Call me Ishmael.', 12_000), false);

const glued = splitAccurateChapters(
  'CHAPTER 1. Loomings. Call me Ishmael. Some years ago I thought I would sail. CHAPTER 2. The Carpet-Bag. I stuffed a shirt or two into my old carpet-bag.',
  'Book',
);
assert.equal(glued.length >= 2, true);
assert.match(glued[0].title, /Chapter 1/);
assert.match(glued[glued.length - 1].title, /Chapter 2/);
assert.match(glued[glued.length - 1].text, /stuffed a shirt/);

console.log('chapter-split tests passed');
