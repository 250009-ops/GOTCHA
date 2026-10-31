/** PAY2-11: the payments-02 release-env doc must carry the G4 warning, and no deploy config may set VITE_LEGAL_V2. */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

let root = resolve(__dirname);
while (!existsSync(join(root, 'docs', 'RELEASE-ENV-payments-02.md')) && root !== resolve(root, '..')) root = resolve(root, '..');
const doc = readFileSync(join(root, 'docs', 'RELEASE-ENV-payments-02.md'), 'utf8');
assert.match(doc, /G4: `VITE_LEGAL_V2` must never be set in the deploy env/, 'release-env doc states G4');
for (const line of doc.split(/\r?\n/).filter((l) => /VITE_LEGAL_V2=true/.test(l))) assert.match(line, /never a deploy build|QA-preview/, 'every VITE_LEGAL_V2=true mention is marked QA-preview only');

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n === 'dist' || n.startsWith('.git')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const deployFiles = ['deploy', 'infra', 'scripts', '.github'].flatMap((d) => walk(join(root, d)));
const offenders = deployFiles.filter((f) => /VITE_LEGAL_V2\s*[:=]/.test(readFileSync(f, 'utf8')));
assert.deepEqual(offenders, [], 'G4: VITE_LEGAL_V2 set in a deploy file');
console.log('release-env-doc (PAY2-11/G4): OK');
