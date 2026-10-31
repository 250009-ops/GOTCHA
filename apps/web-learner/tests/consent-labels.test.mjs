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
