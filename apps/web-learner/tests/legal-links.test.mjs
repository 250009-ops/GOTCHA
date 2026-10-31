import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const lib = readFileSync('src/lib/legalLinks.ts', 'utf8');
const routes = [...lib.match(/WEB_LEGAL_ROUTES = \[([^\]]*)\]/)[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test('payments-02 (G1): consent links Terms of Use, Privacy Policy and Public Offer to apps/web routes', () => {
  assert.deepEqual(routes.sort(), ['/oferta', '/privacy', '/terms']);
  const block = lib.match(/CONSENT_LINK_PATHS[^{]*\{([^}]*)\}/)[1];
  assert.deepEqual([...block.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]]), [['terms', '/terms'], ['privacy', '/privacy'], ['oferta', '/oferta']]);
  const fields = readFileSync('src/components/safety/SignupSafetyFields.tsx', 'utf8');
  assert.match(fields, /CONSENT_LINK_PATHS\.oferta\}\?lang=\$\{l\}/);
});

test('apps/web on payments-02-wlive has the /oferta and /terms routes (when that worktree is present)', () => {
  let app; try { app = readFileSync(process.env.WEB_APP_TSX ?? '/workspace/wt-pay-wlive/apps/web/src/App.tsx', 'utf8'); } catch { return; }
  for (const r of routes) assert.match(app, new RegExp(`path="${r}"`), r);
});

test('QA S2: no learner source links to a legal path outside WEB_LEGAL_ROUTES', () => {
  for (const f of walk('src').filter((f) => /\.(ts|tsx)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:MARKETING_URL|WEB_URL)\}(\/[a-z-]+)/g)) {
      if (/terms|privacy|oferta|legal|offer/.test(m[1])) assert.ok(routes.includes(m[1]), `${f}: ${m[1]}`);
    }
  }
});
