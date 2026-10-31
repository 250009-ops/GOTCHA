import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { checkLegal } from '../scripts/check-legal.mjs';

const gen = 'src/lib/ofertaHtml.generated.ts';
test('oferta HTML has all three languages, no comments', () => {
  const t = readFileSync(gen, 'utf8');
  for (const l of ['"uz"', '"ru"', '"en"']) assert.ok(t.includes(l));
  assert.ok(!t.includes('<!--'));
  assert.ok(t.includes('Public offer for Gotcha Plus passes'));
});
test('publish guard blocks [EFFECTIVE DATE] and [OFERTA URL]', () => {
  const p = checkLegal({ publish: true, files: [gen] });
  assert.ok(p.some((x) => x.includes('[EFFECTIVE DATE]')));
  assert.ok(p.some((x) => x.includes('[OFERTA URL]')));
  assert.deepEqual(checkLegal({ publish: false, files: [gen] }), []);
});
test('/oferta route is registered', () => {
  assert.match(readFileSync('src/App.tsx', 'utf8'), /path="\/oferta" element=\{<OfertaPage \/>\}/);
});
test('/terms renders pending-payments-02 terms (PM 31 Oct), all three languages', () => {
  const t = readFileSync(gen, 'utf8');
  assert.match(t, /export const TERMS_HTML/);
  assert.match(readFileSync('src/App.tsx', 'utf8'), /path="\/terms" element=\{<PendingLegalPage doc="terms" \/>\}/);
  const src = '/workspace/gotcha-handoff/team/pm/legal/web/pending-payments-02';
  const dir = process.env.PENDING_LEGAL_DIR ?? src;
  let have = true; try { readFileSync(`${dir}/terms-en.html`); } catch { have = false; }
  if (have) for (const l of ['en', 'ru', 'uz']) {
    const h = readFileSync(`${dir}/terms-${l}.html`, 'utf8').replace(/<!--[\s\S]*?-->/g, '').trim();
    assert.ok(t.includes(JSON.stringify(h).slice(1, 200)), `terms-${l} verbatim`);
  }
});
