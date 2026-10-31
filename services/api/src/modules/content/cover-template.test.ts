/** covers-01: template cover seed/selection is deterministic and spec-conformant (COVER-STYLE-v1). Pure, no DB. */
import * as assert from 'node:assert/strict';
import {
  COVER_MOTIFS,
  COVER_NAVIES,
  cardTitlePx,
  coverMotifSvg,
  coverSeed,
  fixUzApostrophes,
  fnv1a32,
  heroTitlePx,
  needsLiterata,
  normalizeCoverKey,
  resolveCoverKey,
} from '@gotcha/shared';

// FNV-1a 32 reference vectors
assert.equal(fnv1a32(''), 0x811c9dc5);
assert.equal(fnv1a32('a'), 0xe40c292c);
assert.equal(fnv1a32('foobar'), 0xbf9cf968);

// Golden seeds (frozen: changing these re-skins every book; bump only with a UI/UX decision)
assert.deepEqual(coverSeed('Crime and Punishment', 'classic'), { seed: 3152960245, tint: '#092544', motif: 'arcs' });
assert.deepEqual(coverSeed('Der Schimmelreiter', null), { seed: 302359627, tint: '#092544', motif: 'hatch' });
assert.deepEqual(coverSeed('Преступление и наказание', 'classic'), { seed: 1492336568, tint: '#0C2543', motif: 'horizon' });
assert.deepEqual(coverSeed('Oʻtkan kunlar', 'novel'), { seed: 984458870, tint: '#0C2543', motif: 'hatch' });

// Normalisation: NFC + lowercase + trim ⇒ same cover
assert.deepEqual(coverSeed('  CRIME and punishment ', 'Classic'), coverSeed('Crime and Punishment', 'classic'));
assert.deepEqual(coverSeed('Ölüm'.normalize('NFD'), null), coverSeed('Ölüm', null));
assert.equal(normalizeCoverKey(null), '');
// Genre participates
assert.notEqual(coverSeed('Semaver', 'story').seed, coverSeed('Semaver', 'novel').seed);
// Deterministic across calls; SVG identical
for (let i = 0; i < 50; i++) {
  const a = coverSeed(`Book ${i}`, 'g');
  const b = coverSeed(`Book ${i}`, 'g');
  assert.deepEqual(a, b);
  assert.equal(coverMotifSvg(a.motif, a.tint, a.seed), coverMotifSvg(b.motif, b.tint, b.seed));
}
// Every tint × motif reachable, roughly uniform
const seen = new Map<string, number>();
for (let i = 0; i < 6000; i++) {
  const s = coverSeed(`title ${i}`, 'genre');
  assert.ok((COVER_NAVIES as readonly string[]).includes(s.tint));
  assert.ok((COVER_MOTIFS as readonly string[]).includes(s.motif));
  seen.set(s.tint + s.motif, (seen.get(s.tint + s.motif) ?? 0) + 1);
}
assert.equal(seen.size, 30);
assert.ok(Math.min(...seen.values()) > 120, 'distribution too skewed');

// SVG: only palette colours, no text, no external refs
for (const m of COVER_MOTIFS) {
  const svg = coverMotifSvg(m, '#0A1E39', 12345);
  assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
  assert.ok(!/<text|href|url\(|<script/i.test(svg), `motif ${m} must be pure shapes`);
  const colours = new Set(svg.match(/#[0-9A-Fa-f]{6}/g));
  for (const c of colours) assert.ok(['#0A1E39', '#F5E9CE'].includes(c), `unexpected colour ${c} in ${m}`);
}

// Fonts: Cyrillic / U+02BB titles go to Literata (Fraunces lacks those glyphs)
assert.equal(needsLiterata('Crime and Punishment'), false);
assert.equal(needsLiterata('Преступление'), true);
assert.equal(needsLiterata('Oʻtkan kunlar'), true);
// Uzbek apostrophes normalised to U+02BB
assert.equal(fixUzApostrophes("O'tkan kunlar, g`alaba, o’zbek"), 'Oʻtkan kunlar, gʻalaba, oʻzbek');

// Sizes (spec): card clamp(14px, .11w, 30px), long titles smaller; hero 28–32
assert.equal(cardTitlePx(213, 'Semaver'), 23.4);
assert.equal(cardTitlePx(400, 'Semaver'), 30);
assert.equal(cardTitlePx(100, 'Semaver'), 14);
assert.ok(cardTitlePx(213, 'A very long title that keeps going on') < cardTitlePx(213, 'Short'));
for (const t of ['Semaver', 'Der Schimmelreiter', 'Преступление и наказание: роман в шести частях']) {
  const px = heroTitlePx(t);
  assert.ok(px >= 28 && px <= 32);
}

// API effective cover
assert.equal(resolveCoverKey({ coverMode: 'template', coverImageKey: '/u/a.jpg', originalCoverKey: '/u/a.jpg' }), null);
assert.equal(resolveCoverKey({ coverMode: 'upload', coverImageKey: '/u/new.jpg', originalCoverKey: '/u/a.jpg' }), '/u/new.jpg');
assert.equal(resolveCoverKey({ coverMode: 'original', coverImageKey: '/u/new.jpg', originalCoverKey: '/u/a.jpg' }), '/u/a.jpg');
assert.equal(resolveCoverKey({ coverMode: null, coverImageKey: '/u/a.jpg', originalCoverKey: null }), null);
console.log('cover-template tests: OK');
