import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Covers are the landing-page posters (images), not a drawn motif.
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
test('a stored cover image is shown; template mode does not hide it', () => {
  assert.equal(T.coverImageToShow({ coverMode: 'template', coverImageUrl: '/x.jpg' }), '/x.jpg');
  assert.equal(T.coverImageToShow({ coverMode: 'upload', coverImageUrl: '/x.jpg' }), '/x.jpg');
  assert.equal(T.coverImageToShow({ coverImageUrl: null }), null);
});
test('the six landing books use their poster files, not a motif', () => {
  assert.equal(T.LANDING_COVER_IDS.length, 6);
  assert.equal(T.isLandingCoverId('b8b9b407-ee72-4332-adc5-37c982ebffcc'), true);
  assert.equal(T.isLandingCoverId('not-a-book'), false);
  assert.match(cover, /landingPosterUrl/);
  assert.match(cover, /landingPosterSvg/);
  assert.doesNotMatch(cover, /coverMotifSvg|gc-art/);
  assert.match(lib, /aspect-\[2\/3\]/);
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
  assert.doesNotMatch(lib, /from-black/); // nothing painted over the poster
  assert.doesNotMatch(lib, /bg-white\/90 text-gray-700/); // no chips on the art
});
test('every other book gets a landing-style poster sheet', async () => {
  const P = await import('../../../packages/shared/src/landingPoster.ts');
  const a = P.landingPosterSvg({ title: 'The Tell-Tale Heart', author: 'Edgar Allan Poe', language: 'en', genre: 'horror' });
  const b = P.landingPosterSvg({ title: 'Dunyoning ishlari', author: "O'tkir Hoshimov", language: 'uz', genre: 'classic' });
  assert.match(a, /<svg/);
  assert.match(a, /NO\. /);
  assert.match(a, /ENGLISH/);
  assert.match(a, /The Tell-Tale Heart/);
  assert.match(a, /#2107AA/);
  assert.doesNotMatch(a, /<script/i);
  assert.notEqual(a, b);
  assert.equal(P.posterIssue('The Tell-Tale Heart'), P.posterIssue('The Tell-Tale Heart'));
  assert.match(cover, /data-cover-mode/);
});
test('fonts: Fraunces, Literata, Manrope are loaded for the hero title', () => {
  assert.match(html, /family=Fraunces:opsz,wght,SOFT/);
  assert.match(html, /family=Literata/);
  assert.match(html, /family=Manrope/);
});
