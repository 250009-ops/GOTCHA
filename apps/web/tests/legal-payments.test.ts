import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// payments-02 release line only (never web-launch-04): /terms = pending-payments-02 terms, new /oferta = Public Offer.
const PEND = process.env.LEGAL_PM_PAYMENTS_DIR || '/workspace/gotcha-handoff/team/pm/legal/web/pending-payments-02';
const L = ['en', 'ru', 'uz'] as const;

test('payments-02: legal-pm-payments/ are byte copies of the PM pending-payments-02 terms + oferta', () => {
  for (const d of ['terms', 'oferta']) for (const l of L) assert.equal(readFileSync(`legal-pm-payments/${d}-${l}.html`, 'utf8'), readFileSync(join(PEND, `${d}-${l}.html`), 'utf8'), `${d}-${l} drifted; npm run legal:sync-payments`);
  const lib = readFileSync('src/lib/legalPm.ts', 'utf8');
  for (const d of ['terms', 'oferta']) for (const l of L) assert.ok(lib.includes(`../../legal-pm-payments/${d}-${l}.html?raw`));
});

test('payments-02: /oferta route + footer link + titles (en/ru/uz)', async () => {
  assert.match(readFileSync('src/App.tsx', 'utf8'), /path="\/oferta" element=\{<OfertaPage \/>\}/);
  assert.match(readFileSync('src/components/SiteChrome.tsx', 'utf8'), /to="\/oferta"/);
  const { LEGAL_TITLES } = await import('../src/lib/legalPm.titles.ts');
  assert.deepEqual(LEGAL_TITLES.oferta, { en: 'Public Offer', ru: 'Публичная оферта', uz: 'Ommaviy oferta' });
});

// PAY2-14: the deploy path runs the guarded publish build.
test('PAY2-14: deploy/lib/vite-env.sh builds apps/web with build:publish; build:publish runs check-legal --publish', () => {
  const sh = readFileSync('../../deploy/lib/vite-env.sh', 'utf8');
  assert.match(sh, /VITE_BASE=\/ npm run build:publish --workspace=apps\/web/);
  assert.doesNotMatch(sh, /npm run build --workspace=apps\/web\s*$/m);
  assert.match(JSON.parse(readFileSync('package.json', 'utf8')).scripts['build:publish'], /check-legal\.mjs --publish/);
});

function sandbox(files: Record<string, string>) {
  const d = mkdtempSync(join(tmpdir(), 'cl-'));
  cpSync('scripts', join(d, 'scripts'), { recursive: true });
  for (const [f, t] of Object.entries(files)) { mkdirSync(dirname(join(d, f)), { recursive: true }); writeFileSync(join(d, f), t); }
  return d;
}
const run = (cwd: string, args: string[], env: Record<string, string> = {}) => spawnSync(process.execPath, [join(cwd, 'scripts/check-legal.mjs'), ...args], { cwd, env: { PATH: process.env.PATH!, ...env }, encoding: 'utf8' });
const CLEAN = '<article class="legal" lang="en"><h1>Public offer</h1><p>Effective 1 November 2026.</p></article>';

test('PAY2-14: --publish rejects [TBD BY PM], any [ALL CAPS] placeholder, draft lines (en/ru/uz) and the preview stamp', () => {
  for (const bad of ['[TBD BY PM]', '[EFFECTIVE DATE]', '[OFERTA URL]', '[CLAIM PERIOD]', '[SOME NEW TOKEN]', 'DRAFT, NOT PUBLISHED', 'ЧЕРНОВИК, НЕ ОПУБЛИКОВАН', 'LOYIHA, EʼLON QILINMAGAN']) {
    const d = sandbox({ 'legal-pm-payments/oferta-en.html': CLEAN.replace('1 November 2026', bad) });
    const r = run(d, ['--publish']);
    assert.notEqual(r.status, 0, `publish must reject ${bad}`);
    rmSync(d, { recursive: true });
  }
  const ok = sandbox({ 'legal-pm-payments/oferta-en.html': CLEAN });
  assert.equal(run(ok, ['--publish']).status, 0, 'clean text publishes');
  const st = run(ok, ['--publish'], { VITE_PREVIEW_STAMP: 'true' });
  assert.notEqual(st.status, 0); assert.match(st.stderr, /VITE_PREVIEW_STAMP/);
  assert.notEqual(run(ok, ['--publish'], { LEGAL_DRAFT_PREVIEW: '1' }).status, 0, 'draft preview flag refused on publish');
  rmSync(ok, { recursive: true });
});

test('PAY2-14: the real pending PM text is NOT publishable today (placeholders + draft lines) — G1 stays open', () => {
  const r = run(process.cwd(), ['--publish']);
  assert.notEqual(r.status, 0);
  for (const m of ['[EFFECTIVE DATE]', '[OFERTA URL]', 'NOT PUBLISHED']) assert.ok(r.stderr.includes(m), m);
});

test('LEGAL_DRAFT_PREVIEW=1 lets a plain (non-publish) build carry the pending drafts; without it the draft line still fails', () => {
  const d = sandbox({ 'legal-pm-payments/oferta-ru.html': CLEAN.replace('1 November 2026', 'ЧЕРНОВИК, НЕ ОПУБЛИКОВАН'), 'legal-pm-payments/oferta-en.html': CLEAN.replace('1 November 2026', 'DRAFT, NOT PUBLISHED') });
  assert.notEqual(run(d, []).status, 0);
  assert.equal(run(d, [], { LEGAL_DRAFT_PREVIEW: '1' }).status, 0);
  // comments are never relaxed
  writeFileSync(join(d, 'legal-pm-payments/oferta-en.html'), CLEAN + '<!-- note -->');
  assert.notEqual(run(d, [], { LEGAL_DRAFT_PREVIEW: '1' }).status, 0);
  rmSync(d, { recursive: true });
});
