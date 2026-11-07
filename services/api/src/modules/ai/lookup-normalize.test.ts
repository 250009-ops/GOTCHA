import * as assert from 'node:assert/strict';
import {
  LOOKUP_CACHE_VERSION,
  catalogLemmas,
  classifyLookup,
  displaySentenceHead,
  glossLimitsFor,
  looksLikeAuxiliaryOnlyGloss,
  looksLikeDefinitionGloss,
  looksLikeOffDomainExecute,
  looksLikeSynonymDump,
  looksLikeWrongScript,
  needsLookupRepair,
  normalizeCatalogLemma,
  normalizeUzbekOrthography,
  sanitizeContextualMeaning,
  sanitizeGloss,
  sanitizePhrase,
} from './lookup-normalize';

assert.equal(classifyLookup('hand', 'Nothing! and noon at hand!'), 'word');
assert.equal(classifyLookup('at hand', 'Nothing! and noon at hand!'), 'phrase');
assert.equal(classifyLookup('might have known', 'I might have known it, too.'), 'phrase');
assert.equal(
  classifyLookup('I might have known it, too.', 'I might have known it, too.'),
  'sentence',
);
assert.equal(
  classifyLookup('Nothing! and noon at hand!', 'Nothing! and noon at hand!'),
  'sentence',
);
assert.equal(
  classifyLookup(
    'Call me Ishmael. Some years ago never mind how long precisely.',
    'Call me Ishmael. Some years ago never mind how long precisely.',
  ),
  'sentence',
);

assert.equal(
  sanitizePhrase('at hand', 'Nothing! and noon at hand!', 'hand', 'word'),
  'at hand',
);
assert.equal(
  sanitizePhrase('at hand', 'Nothing! and noon at hand!', 'hand', 'sentence'),
  null,
);
assert.equal(
  sanitizePhrase('winning chances', 'the regular look outs kept a bright lookout', 'outs', 'word'),
  null,
);

const sentence = 'Nothing! and noon at hand!';
const uz = 'Hech narsa! va tush yaqin!';
assert.equal(
  sanitizeGloss(uz, sentence, glossLimitsFor('sentence'), 'sentence'),
  uz,
);

const wordGloss = sanitizeGloss(
  'yutish imkoniyatlari yoki qolgan variantlar. boshqa gap.',
  'outs',
  glossLimitsFor('word'),
  'word',
);
assert.ok(wordGloss.split(/\s+/).length <= 8);

assert.equal(
  sanitizeContextualMeaning('yaqin vaqt', 'yaqin', 'word'),
  'yaqin vaqt',
);
assert.equal(
  sanitizeContextualMeaning('oldin bilish yoki taxmin qilish', 'ehtimol', 'word'),
  'oldin bilish yoki taxmin qilish',
);
assert.equal(sanitizeContextualMeaning('yaqin', 'yaqin', 'word'), null);
assert.equal(sanitizeContextualMeaning('tush yaqin', uz, 'sentence'), null);
assert.equal(
  sanitizeContextualMeaning('amalga oshirish, bajarish', 'bor', 'phrase', 'I have run him by last night.'),
  null,
);

assert.equal(looksLikeDefinitionGloss('yaqin'), false);
assert.equal(looksLikeDefinitionGloss('yaqin vaqt'), false);
assert.equal(looksLikeDefinitionGloss('oldin bilish yoki taxmin qilish'), true);

assert.equal(looksLikeSynonymDump('amalga oshirish, bajarish'), true);
assert.equal(looksLikeSynonymDump('kechasi orqadan o\'tib ketmoq'), false);
assert.equal(
  looksLikeOffDomainExecute('amalga oshirish, bajarish', 'Aye, aye, I have run him by last night.'),
  true,
);
assert.equal(
  looksLikeOffDomainExecute('quvib o\'tmoq', 'Aye, aye, I have run him by last night.'),
  false,
);
assert.equal(looksLikeAuxiliaryOnlyGloss('bor', 'have run', 'phrase'), true);
assert.equal(looksLikeAuxiliaryOnlyGloss('quvib o\'tmoq', 'have run', 'phrase'), false);
assert.equal(
  needsLookupRepair({
    kind: 'phrase',
    surface: 'have run',
    sentence: 'Aye, aye, I have run him by last night.',
    translation: 'bor',
    contextualMeaning: 'amalga oshirish, bajarish',
  }),
  true,
);
assert.equal(
  needsLookupRepair({
    kind: 'phrase',
    surface: 'have run',
    sentence: 'Aye, aye, I have run him by last night.',
    translation: 'quvib o\'tmoq',
    contextualMeaning: 'kechasi orqadan o\'tib ketmoq',
  }),
  false,
);

assert.equal(
  sanitizeContextualMeaning('hech ikkilanmasdan, darhol', 'ikkilanish', 'word'),
  'hech ikkilanmasdan, darhol',
);
assert.equal(sanitizeContextualMeaning('bir, ikki, uch', 'nol', 'word'), 'bir');
assert.equal(looksLikeDefinitionGloss('four words stay here'), false);

assert.equal(LOOKUP_CACHE_VERSION, 'v13');
assert.equal(normalizeUzbekOrthography("quvib o'tmoq"), 'quvib o\u02BBtmoq');
assert.equal(normalizeUzbekOrthography("g'alaba"), 'g\u02BBalaba');
assert.equal(normalizeUzbekOrthography("ma'no"), 'ma\u02BCno');
assert.equal(normalizeUzbekOrthography('ma\u02BBno'), 'ma\u02BCno');
assert.equal(normalizeUzbekOrthography('o\u02BBtmoq'), 'o\u02BBtmoq');
assert.equal(looksLikeWrongScript('колебание', 'uz'), true);
assert.equal(looksLikeWrongScript('ikkilanish', 'uz'), false);
assert.equal(looksLikeWrongScript('колебание', 'ru'), false);

assert.ok(displaySentenceHead(sentence).includes('Nothing'));
assert.ok(displaySentenceHead('one '.repeat(40)).endsWith('…'));

assert.equal(normalizeCatalogLemma("O'qituvchi"), 'o\u02BBqituvchi');
assert.equal(normalizeCatalogLemma("G'alaba"), 'g\u02BBalaba');
assert.equal(normalizeCatalogLemma("Don't"), 'don\u02BCt');
assert.equal(normalizeCatalogLemma('Книга'), 'книга');
assert.equal(normalizeCatalogLemma('A'), '');
assert.deepEqual(catalogLemmas("The o'qituvchi ran."), ['the', 'o\u02BBqituvchi', 'ran']);

console.log('lookup-normalize tests passed');
