import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkLegal } from '../scripts/check-legal.mjs';

const f = (t) => { const p = join(mkdtempSync(join(tmpdir(), 'g-')), 'x.html'); writeFileSync(p, t); return p; };
test('PAY2-14: publish rejects [TBD BY PM], any [ALL CAPS] placeholder, ru/uz/en draft lines and the preview stamp', () => {
  for (const bad of ['[TBD BY PM]', '[EFFECTIVE DATE]', '[NEW TOKEN]', '[X]', 'NOT PUBLISHED', 'НЕ ОПУБЛИКОВАН', 'EʼLON QILINMAGAN']) assert.ok(checkLegal({ publish: true, files: [f(`<p>${bad}</p>`)] }).length, bad);
  assert.deepEqual(checkLegal({ publish: true, files: [f('<p>Effective 1 November 2026</p>')] }), []);
  assert.ok(checkLegal({ publish: true, files: [], env: { VITE_PREVIEW_STAMP: 'true' } }).length);
  assert.deepEqual(checkLegal({ publish: false, files: [f('<p>[TBD BY PM]</p>')], env: { VITE_PREVIEW_STAMP: 'true' } }), [], 'plain build: preview allowed');
});
