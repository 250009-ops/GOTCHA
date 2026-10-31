import * as assert from 'node:assert/strict';
import { splitAccurateChapters, spelledToInt } from './chapter-split';

const words = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'];
const body = (i: number) => `The rain fell on the town for the ${i}th time. ` + 'He walked along the river and thought about the long train ride, the strange man, and the letter. '.repeat(30);
// Paragraph layout: heading on its own line.
const para = words.map((w, i) => `${w}\n\n${body(i)}`).join('\n\n');
assert.equal(splitAccurateChapters(para, 'Book').length, 6);
// Whitespace-collapsed layout (old import): heading glued to the first sentence, mid-paragraph too.
const collapsed = words.map((w, i) => `${w} ${body(i)}`).join(' ');
const c = splitAccurateChapters(collapsed, 'Book');
assert.equal(c.length, 6, c.map((x) => x.title).join(','));
assert.equal(c[5].title, 'Chapter 6');
// "Sept. 6 Dear Charles" is a letter date, never "Chapter 6. Dear".
const letter = para + '\n\n' + 'He tore it open. Sept. 6 Dear Charles, I do not understand your message to me at all, she wrote.';
assert.ok(!splitAccurateChapters(letter, 'Book').some((x) => /Dear/.test(x.title)));
// Prose "…he said. Two men came in." is not a heading (no counting-up run).
const prose = 'Nothing happened. ' + body(1) + ' he said. Two men came in. ' + body(2);
assert.equal(splitAccurateChapters(prose, 'Book').length, 1);
assert.equal(spelledToInt('Twenty-six'), 26);
assert.equal(spelledToInt('Twentyfour'), 24);
assert.equal(spelledToInt('Forty'), 40);
assert.equal(spelledToInt('Dear'), null);
console.log('w28-split: OK');
