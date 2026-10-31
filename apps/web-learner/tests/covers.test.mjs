import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// covers-01: landing-style template covers drawn in code (COVER-STYLE-v1). Logic + wiring checks.
const T = await import('../../../packages/shared/src/coverTemplate.ts');
const lib = readFileSync('src/pages/LibraryPage.tsx', 'utf8');
const cover = readFileSync('src/components/cover/BookCover.tsx', 'utf8');
const html = readFileSync('index.html', 'utf8');

test('seed is deterministic and matches the API golden values', () => {
  assert.deepEqual(T.coverSeed('Crime and Punishment', 'classic'), { seed: 3152960245, tint: '#092544', motif: 'arcs' });
  assert.deepEqual(T.coverSeed('Oʻtkan kunlar', 'novel'), { seed: 984458870, tint: '#0C2543', motif: 'hatch' });
  assert.deepEqual(T.coverSeed(' CRIME AND PUNISHMENT ', 'Classic'), T.coverSeed('Crime and Punishment', 'classic'));
});
test('one palette; only the art panel varies across the 6 measured navies', () => {
  assert.deepEqual({ ...T.COVER_PALETTE }, { paper: '#F4ECDF', ink: '#14112B', brand: '#2107AA', frame: '#CBC3B6', cream: '#F5E9CE' });
  assert.deepEqual([...T.COVER_NAVIES], ['#0A1E39', '#092544', '#0C2543', '#1A193A', '#152435', '#152A44']);
});
test('template mode never shows an image; upload/original do', () => {
  assert.equal(T.coverImageToShow({ coverMode: 'template', coverImageUrl: '/x.jpg' }), null);
  assert.equal(T.coverImageToShow({ coverMode: 'upload', coverImageUrl: '/x.jpg' }), '/x.jpg');
  assert.equal(T.coverImageToShow({ coverImageUrl: null }), null);
});
test('Cyrillic and oʻ/gʻ titles use Literata first (Fraunces lacks them)', () => {
  assert.match(T.coverTitleFontStack('Преступление'), /^Literata/);
  assert.match(T.coverTitleFontStack('Oʻtkan kunlar'), /^Literata/);
  assert.match(T.coverTitleFontStack('Semaver'), /^Fraunces, Literata, serif$/);
  assert.equal(T.fixUzApostrophes("O'tkan g`alaba"), 'Oʻtkan gʻalaba');
});
test('library uses BookCover for card, thumb and the continue-reading hero', () => {
  assert.match(lib, /<BookCover item=\{item\} variant=\{variant\}/);
  assert.match(lib, /variant="thumb"/);
  assert.match(lib, /<BookCover item=\{item\} variant="hero"/);
  assert.doesNotMatch(lib, /from-black\/40 to-transparent/); // spec: remove the old gradient on paper covers
  assert.match(lib, /bg-white\/90 text-gray-700/); // badges on a white/90 chip
});
test('size rules: card clamp(14px,.11w,30px) ≤3 lines, author hidden <150px, hero 2 lines, thumb no text', () => {
  assert.match(cover, /font-size:clamp\(14px,var\(--gc-k,11cqw\),30px\)/);
  assert.match(cover, /-webkit-line-clamp:\$\{CARD_TITLE_MAX_LINES\}/);
  assert.equal(T.CARD_TITLE_MAX_LINES, 3);
  assert.equal(T.HERO_TITLE_MAX_LINES, 2);
  assert.match(cover, /@container \(max-width:149\.98px\)\{\.gc-cover\[data-v=card\] \.gc-author\{display:none\}/);
  assert.match(cover, /variant === 'card' && showText/);
  assert.match(cover, /height:46%;background:linear-gradient\(to top,\$\{COVER_PALETTE\.ink\}/);
});
test('fonts: Fraunces, Literata, Manrope are loaded; no AI/image calls in the cover code', () => {
  assert.match(html, /family=Fraunces:opsz,wght,SOFT/);
  assert.match(html, /family=Literata/);
  assert.match(html, /family=Manrope/);
  assert.doesNotMatch(cover, /fetch\(|openai|api\(/i);
});
