// QA 2: web (incl. /oferta, /terms, /privacy, which are SPA routes of this index.html) declares color-scheme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

test('QA 2: index.html declares <meta name="color-scheme" content="light"> and :root color-scheme: light', () => {
  assert.match(readFileSync('index.html', 'utf8'), /<meta name="color-scheme" content="light" \/>/);
  assert.match(readFileSync('src/gotcha-tokens.css', 'utf8'), /:root \{[\s\S]*?color-scheme: light;/);
  if (existsSync('dist/index.html')) assert.match(readFileSync('dist/index.html', 'utf8'), /name="color-scheme" content="light"/);
});
test('WLF-21: /oferta is a served route (App.tsx) backed by legal-pm-payments oferta files', () => {
  assert.match(readFileSync('src/App.tsx', 'utf8'), /<Route path="\/oferta" element=\{<OfertaPage \/>\} \/>/);
  for (const l of ['en', 'ru', 'uz']) assert.ok(existsSync(`legal-pm-payments/oferta-${l}.html`));
});
