import * as assert from 'node:assert/strict';
import { cleanImportPlainText, joinHardWraps } from './import-text-cleaner';

// Fixtures modelled on the QA Crime and Punishment capture ('agi-/tated').
assert.equal(joinHardWraps('he was agi-\ntated and\nfeverish.'), 'he was agitated and feverish.');
assert.equal(joinHardWraps('he was agi- tated.'), 'he was agitated.');
assert.equal(joinHardWraps('pre- and post-war'), 'pre- and post-war');
assert.equal(joinHardWraps('Raskolnikov was well-known.'), 'Raskolnikov was well-known.');
assert.equal(joinHardWraps('A Cyrillic взвол-\nнованный man'), 'A Cyrillic взволнованный man');
// Sentence ends / headings / dialogue lines keep their breaks.
assert.equal(joinHardWraps('He left.\nthen'), 'He left.\nthen');
assert.equal(joinHardWraps('PART I\nCHAPTER I\nOn an exceptionally hot'), 'PART I\nCHAPTER I\nOn an exceptionally hot');
assert.equal(joinHardWraps('“Yes,” he said\n“No.”'), '“Yes,” he said\n“No.”');
assert.equal(joinHardWraps('para one.\n\nnext para'), 'para one.\n\nnext para');
const out = cleanImportPlainText('On an exceptionally hot evening early in July a young man went out of the garret in which he lodged in S. Place and walked slowly, as though in hesi-\ntation, towards K. bridge. He was agi-\ntated.');
assert.ok(out.includes('in hesitation, towards') && out.includes('He was agitated.'), out);
console.log('s4-dehyphen: OK');
