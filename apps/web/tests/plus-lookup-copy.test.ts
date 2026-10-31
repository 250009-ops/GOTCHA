import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
// 31 Oct 14:40: Plus has no daily lookup cap. Shipped web copy names no Plus lookup number and no limit claim;
// "No daily limit on word lookups" ships only with payments-02 (release guard G1). Plan bullets come from the API.
// final-6.1 (payments ON since final-6, so G1 is met): Marketing FINAL (LANDING-COPY-v2 14:33:59) wording 'no daily limit on word lookups'
// is allowed ONLY in src/lib/landingCopy.ts; every other ban (unlimited, fair use, 200 lookups, cheksiz, безлимит) still applies everywhere.
// legalHtml.generated.ts (wl01 legal drafts) was retired in web-launch-04; the filter below is a no-op kept for safety.
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const BANNED = /\b(unlimited|fair use|200 word lookups|200 lookups|no daily limit)\b|cheksiz|безлимит/i;
const STRING = /(['"`])((?:\\.|(?!\1).)*)\1/g;
test('no shipped web copy says unlimited / fair use / 200 (word) lookups / no daily limit', () => {
  const hits: string[] = [];
  for (const f of walk('src').filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes('legalHtml.generated'))) {
    const rel = f.replaceAll('\\', '/');
    for (const m of readFileSync(f, 'utf8').matchAll(STRING)) if (BANNED.test(rel.endsWith('lib/landingCopy.ts') ? m[2].replace(/no daily limit on word lookups/gi, '') : m[2])) hits.push(`${rel}: ${m[2].slice(0, 80)}`);
  }
  assert.deepEqual(hits, []);
});
