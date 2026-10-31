// WLF-35 (final-6.1a, Kai): /marketing/landing retired with 410; the controller stays GET-only.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const src = readFileSync(join(__dirname, 'marketing.controller.ts'), 'utf8');
assert.match(src, /@Get\('landing'\)/);
assert.ok(!/@(Post|Put|Patch|Delete|All)\(/.test(src), 'marketing controller must be GET-only');
import('./marketing.controller').then(({ MarketingController }) => {
  const c = new MarketingController({ landing: () => { throw new Error('service must not be called'); } } as never);
  assert.throws(() => c.landing(), (e: { getStatus(): number }) => e.getStatus() === 410);
  console.log('wlf35-landing-readonly: OK');
});
