import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const lib = readFileSync('src/lib/legalLinks.ts', 'utf8');
const routes = [...lib.match(/WEB_LEGAL_ROUTES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test('consent links only Terms of Use and Privacy Policy, both to real apps/web routes (no oferta)', () => {
  assert.deepEqual(routes.sort(), ['/privacy', '/terms']);
  const block = lib.match(/CONSENT_LINK_PATHS[^{]*\{([^}]*)\}/)[1];
  assert.deepEqual([...block.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]), [['terms', '/terms'], ['privacy', '/privacy']]);
  assert.ok(!/oferta/.test(block));
  const fields = readFileSync('src/components/safety/SignupSafetyFields.tsx', 'utf8');
  assert.ok(!/oferta/i.test(fields), 'no oferta href in SignupSafetyFields');
});

test('QA S2: no learner source links to a legal path outside WEB_LEGAL_ROUTES', () => {
  for (const f of walk('src').filter((f) => /\.(ts|tsx)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:MARKETING_URL|WEB_URL)\}(\/[a-z-]+)/g)) {
      if (/terms|privacy|oferta|legal|offer/.test(m[1])) assert.ok(routes.includes(m[1]), `${f}: ${m[1]}`);
    }
    assert.ok(!/['"`]\/oferta/.test(s) && !/\}\/oferta/.test(s), `${f} links to retired /oferta`);
  }
});
