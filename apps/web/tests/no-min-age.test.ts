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

// LG4-07: no auto-renew / offline / unlimited / no-ads / $ claims in LegalPage copy (passes are one-off, soʻm).
const CLAIMS = /automatically renew|автоматически продлева|avtomatik ravishda yangilan|offline|unlimited|безлимит|cheksiz|no ads|без рекламы|reklamasiz|\$\s?\d/i;
test('LG4-07: no false plan claims in legal copy', () => {
  for (const l of ['en', 'ru', 'uz']) assert.ok(!CLAIMS.test(readFileSync(`src/lib/legalCopy.${l}.ts`, 'utf8')), l);
});
