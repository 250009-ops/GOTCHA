import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LEGAL_HTML_V2 } from '../src/lib/legalHtml.generated.ts';

test('legal v2: terms/privacy/oferta in uz/ru/en, no comments, oferta URL wired, no empty seller fields', () => {
  for (const lang of ['uz', 'ru', 'en'] as const) for (const doc of ['terms', 'privacy', 'oferta'] as const) {
    const h = LEGAL_HTML_V2[lang][doc];
    assert.ok(h.length > 1000, `${doc}-${lang}`);
    assert.ok(!h.includes('<!--') && !h.includes('-->'), `${doc}-${lang} comment`);
    assert.ok(!/\[(OFERTA URL|TTS RETENTION|SELLER|STIR|INN|BANK)/.test(h), `${doc}-${lang} placeholder`);
  }
  assert.ok(LEGAL_HTML_V2.en.oferta.includes('https://gotchaa.uz/oferta'));
});

test('[EFFECTIVE DATE] stays visible and check-legal --publish blocks it', () => {
  assert.ok(LEGAL_HTML_V2.en.terms.includes('<mark class="placeholder">[EFFECTIVE DATE]</mark>'));
  assert.ok(readFileSync('scripts/check-legal.mjs', 'utf8').includes("'[EFFECTIVE DATE]'"));
});
