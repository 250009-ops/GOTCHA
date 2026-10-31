// WLF-30: Uzbek UI copy uses ʻ (U+02BB) after o/g and ʼ (U+02BC) as tutuq belgisi, never the ASCII apostrophe.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const roots = [new URL('../src', import.meta.url).pathname, new URL('../../../packages/shared/src', import.meta.url).pathname];
// chatLang.ts: language-detection keywords for user input, intentionally accepts ASCII spellings.
const SKIP = /chatLang\.ts$|\.test\./;
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const BAD = /[A-Za-z]['’][A-Za-z]/;
const bad = [];
for (const f of roots.flatMap(walk).filter((p) => /\.(ts|tsx)$/.test(p) && !SKIP.test(p))) {
  const src = readFileSync(f, 'utf8');
  // (a) `const uz… = {` blocks
  const blocks = [...src.matchAll(/^(?:export )?const uz\w*[^=\n]*=\s*\{[\s\S]*?^\};/gm)].map((m) => m[0]);
  // (c) nested `  uz: {` … `  },` blocks (same indent)
  for (const m of src.matchAll(/^( +)uz: \{\n([\s\S]*?)^\1\},?$/gm)) blocks.push(m[2]);
  for (const m of blocks.map((b) => [b])) {
    m[0].split('\n').forEach((l, i) => { const s = [...l.matchAll(/"([^"\n]*)"|`([^`\n]*)`|'([^'\n]*)'/g)].map((x) => x[1] ?? x[2] ?? x[3]).join(' '); if (BAD.test(s)) bad.push(`${f}: ${l.trim()}`); });
  }
  // (b) inline uz: "…" values
  for (const m of src.matchAll(/\buz:\s*(?:"([^"\n]*)"|`([^`\n]*)`|'([^'\n]*)')/g)) { const s = m[1] ?? m[2] ?? m[3]; if (BAD.test(s)) bad.push(`${f}: uz: ${s}`); }
}
assert.deepEqual(bad, [], 'ASCII apostrophe in uz copy:\n' + bad.join('\n'));
// the checker itself catches the bug shape
assert.ok(BAD.test("So'z") && BAD.test("ma'no") && !BAD.test('Soʻz') && !BAD.test('maʼno'));
console.log('wlf30-uz-apostrophe: OK');

// UI/UX 6.1a: the Practice copy is explicitly covered (uz block of packages/shared/src/practiceCopy.ts).
{
  const pc = readFileSync(new URL('../../../packages/shared/src/practiceCopy.ts', import.meta.url), 'utf8');
  const m = /^(?:export )?const uz\w*[^=\n]*=\s*\{[\s\S]*?^\};/m.exec(pc) || /^( +)uz: \{\n([\s\S]*?)^\1\},?$/m.exec(pc);
  if (!m) throw new Error('practiceCopy uz block not found');
  const bad = m[0].split('\n').filter((l) => /[A-Za-z]['’][A-Za-z]/.test(l.replace(/^[^'"`]*/, '')));
  if (bad.length) throw new Error('practiceCopy uz has ASCII/’ apostrophes:\n' + bad.join('\n'));
  if (!/[oOgG]ʻ/.test(m[0])) throw new Error('practiceCopy uz block should contain oʻ/gʻ (U+02BB)');
  console.log('wlf30 practiceCopy uz: OK');
}
