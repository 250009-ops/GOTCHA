// S3: the sign-up tick-box labels must be verbatim from PM's README. Run: node tests/consent-labels.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const src = readFileSync(new URL('../src/components/safety/signupConsent.ts', import.meta.url), 'utf8');
const readme = readFileSync(process.env.LEGAL_README ?? '/workspace/gotcha-handoff/team/pm/legal/web/README.md', 'utf8');
for (const l of ['uz', 'ru', 'en']) {
  const m = src.match(new RegExp(`^  ${l}: '(.+)',$`, 'm'));
  assert.ok(m, `label ${l} missing`);
  assert.ok(readme.includes(m[1]), `label ${l} is not verbatim from README`);
}
console.log('consent labels verbatim: OK');

// web-2026-10-31.2: all three documents are links.
import('../src/components/safety/signupConsent.ts').then(({ consentParts }) => {
  for (const l of ['uz', 'ru', 'en']) {
    const links = consentParts(l).filter((p) => p.link).map((p) => p.link).sort();
    assert.deepEqual(links, ['oferta', 'privacy', 'terms'], l);
  }
  console.log('consent links terms/privacy/oferta: OK');
});
