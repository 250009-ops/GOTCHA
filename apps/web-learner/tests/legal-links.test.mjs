import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const lib = readFileSync('src/lib/legalLinks.ts', 'utf8');
const routes = [...lib.match(/WEB_LEGAL_ROUTES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test('QA S2: every consent legal link resolves to a known apps/web route (no retired /oferta)', () => {
  assert.deepEqual(routes.sort(), ['/privacy', '/terms']);
  const paths = [...lib.match(/CONSENT_LINK_PATHS[^{]*\{([^}]*)\}/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.equal(paths.length, 3);
  for (const p of paths) assert.ok(routes.includes(p), p);
  const fields = readFileSync('src/components/safety/SignupSafetyFields.tsx', 'utf8');
  assert.match(fields, /CONSENT_LINK_PATHS\.oferta/);
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
