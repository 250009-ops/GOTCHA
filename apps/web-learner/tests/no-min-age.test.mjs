import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// Owner 31 Oct: no minimum age. Guard learner + shared copy against "13+" style wording.
const BAD = /13\s*\+|at least 13|under the age of 13|не менее 13|младше 13 лет|kamida 13|13 yoshgacha|13 yoshdan kichik|minimum age|минимальн\S* возраст/i;
const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
test('no minimum-age wording', () => {
  const hits = [...walk('src'), ...walk('../../packages/shared/src')].filter((f) => /\.(ts|tsx|json)$/.test(f) && BAD.test(readFileSync(f, 'utf8')));
  assert.deepEqual(hits, []);
});
