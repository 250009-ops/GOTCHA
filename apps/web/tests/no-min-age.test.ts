import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// No minimum age now (owner, 31 Oct): no "13+" / "at least 13" style wording may come back.
const BAD = /13\s*\+|at least 13|under the age of 13|не менее 13|младше 13 лет|kamida 13|13 yoshgacha|13 yoshdan kichik|minimum age|минимальн\w* возраст/i;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
test('no minimum-age wording in web copy', () => {
  const hits = walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('legalHtml.generated'))
    .filter((f) => BAD.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});
