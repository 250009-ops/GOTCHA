import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// QA S2 (31 Oct): every legal link on the marketing site must hit a real route in App.tsx.
const app = readFileSync('src/App.tsx', 'utf8');
const routes = new Set([...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]));
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));

test('QA S2: legal links (terms/privacy/oferta/legal) in apps/web resolve to App.tsx routes', () => {
  assert.ok(routes.has('/terms') && routes.has('/privacy'), [...routes].join(','));
  let n = 0;
  for (const f of walk('src').filter((f) => /\.(ts|tsx)$/.test(f))) {
    const s = readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:to|href)=["{`']+(\/[a-z-]*(?:terms|privacy|oferta|offer|legal)[a-z-]*)/g)) {
      n++; assert.ok(routes.has(m[1]), `${f}: ${m[1]} has no route`);
    }
  }
  assert.ok(n >= 2, 'footer legal links found');
});
