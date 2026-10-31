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
test('publish guard blocks [EFFECTIVE DATE] and [OFERTA URL]', async () => {
  // r3b: PM filled both placeholders in pending-payments-02 (17:15), so the guard is checked on a fixture and the real file must pass.
  const { mkdtempSync, writeFileSync } = await import('node:fs'); const { tmpdir } = await import('node:os');
  const fx = mkdtempSync(tmpdir() + '/oferta-') + '/fx.ts';
  writeFileSync(fx, 'export const X = "<p>Effective date: [EFFECTIVE DATE]. Offer: [OFERTA URL]</p>";\n');
  assert.deepEqual(checkLegal({ publish: true, files: [gen] }), [], 'generated legal is publishable');
  const p = checkLegal({ publish: true, files: [fx] });
  assert.ok(p.some((x) => x.includes('[EFFECTIVE DATE]')));
  assert.ok(p.some((x) => x.includes('[OFERTA URL]')));
  assert.deepEqual(checkLegal({ publish: false, files: [fx] }), []);
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

// Round-3b (PM 17:20, Kai decision A: remedy choice in terms §8 / oferta §7): generated from pending-payments-02 with these sha256 pins.
test('pending-payments-02 source pins (r3b, 17:20)', async () => {
  const { createHash } = await import('node:crypto');
  const PINS = { 'terms-en.html': 'd5d1b69a2ab2', 'terms-ru.html': '9634a85dd35f', 'terms-uz.html': '6146bd79835a',
    'oferta-en.html': '3dfc03dd6872', 'oferta-ru.html': 'ed44973e592d', 'oferta-uz.html': '6cf90e1b8bb4' };
  const dir = '/workspace/gotcha-handoff/team/pm/legal/web/pending-payments-02';
  let have = true; try { readFileSync(`${dir}/terms-en.html`); } catch { have = false; }
  if (!have) return;
  for (const [f, pin] of Object.entries(PINS)) assert.equal(createHash('sha256').update(readFileSync(`${dir}/${f}`)).digest('hex').slice(0, 12), pin, f);
  const t = readFileSync(gen, 'utf8');
  assert.match(t, /you may choose the remedy/); assert.doesNotMatch(t, /rather than returning the money/);
});
test('PAY2-24: the plain CLI check (no --publish) runs in publish mode unless LEGAL_DRAFT_PREVIEW=1', async () => {
  const { mkdtempSync, mkdirSync, writeFileSync } = await import('node:fs'); const { tmpdir } = await import('node:os'); const { spawnSync } = await import('node:child_process'); const { resolve } = await import('node:path');
  const d = mkdtempSync(tmpdir() + '/legal-cli-'); mkdirSync(d + '/src/lib', { recursive: true });
  writeFileSync(d + '/src/lib/ofertaHtml.generated.ts', 'export const X = "<p>[EFFECTIVE DATE]</p>";\n');
  const cli = resolve('scripts/check-legal.mjs');
  const env = { ...process.env }; delete env.LEGAL_DRAFT_PREVIEW;
  const r = spawnSync(process.execPath, [cli], { cwd: d, env, encoding: 'utf8' });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /\[EFFECTIVE DATE\]/);
  assert.equal(spawnSync(process.execPath, [cli], { cwd: d, env: { ...env, LEGAL_DRAFT_PREVIEW: '1' }, encoding: 'utf8' }).status, 0);
  assert.notEqual(spawnSync(process.execPath, [cli, '--publish'], { cwd: d, env: { ...env, LEGAL_DRAFT_PREVIEW: '1' }, encoding: 'utf8' }).status, 0);
});
