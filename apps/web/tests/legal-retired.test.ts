import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const walk = (d: string): string[] => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));

test('web-launch-04: wl01 legal drafts and their generated HTML are retired', () => {
  for (const f of ['legal-src', 'src/lib/legalHtml.generated.ts', 'src/pages/LegalV2Page.tsx', 'scripts/gen_legal.py']) assert.ok(!existsSync(f), f);
  const pkg = readFileSync('package.json', 'utf8');
  assert.ok(!pkg.includes('VITE_LEGAL_V2') && !pkg.includes('legal:gen'));
});

test('LP2-04: VITE_LEGAL_V2 switches nothing in src', () => {
  const hits = walk('src').filter((f) => readFileSync(f, 'utf8').includes('VITE_LEGAL_V2') && !readFileSync(f, 'utf8').includes('retired'));
  assert.deepEqual(hits, []);
});

test('LP2-04: check-legal fails when VITE_LEGAL_V2=true; publish guard still blocks placeholders', () => {
  const r = spawnSync(process.execPath, ['scripts/check-legal.mjs'], { env: { ...process.env, VITE_LEGAL_V2: 'true' }, encoding: 'utf8' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /VITE_LEGAL_V2/);
  const src = readFileSync('scripts/check-legal.mjs', 'utf8');
  for (const p of ["'[EFFECTIVE DATE]'", "'[OFERTA URL]'", "'DRAFT, NOT PUBLISHED'", "'QA DRAFT'"]) assert.ok(src.includes(p), p);
});
