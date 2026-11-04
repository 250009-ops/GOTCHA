/** PAY2-17: the API records the consent version the client displayed; it never upgrades a .3 client to .4. */
import * as assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { CONSENT_LABELS, CONSENT_VERSION, CONSENT_VERSION_PRE_OFERTA, recordedConsentVersion } from './consent';

assert.equal(CONSENT_VERSION, 'web-2026-10-31.4');
assert.equal(CONSENT_VERSION_PRE_OFERTA, 'web-2026-10-31.3');
// Shipped gotcha-fix learner sends no consentVersion and shows the Terms + Privacy label → .3, never .4.
assert.equal(recordedConsentVersion(undefined), 'web-2026-10-31.3');
assert.equal(recordedConsentVersion(null), 'web-2026-10-31.3');
assert.equal(recordedConsentVersion('  '), 'web-2026-10-31.3');
// The payments-02 learner sends the .4 it displayed (Terms + Privacy + Public Offer).
assert.equal(recordedConsentVersion('web-2026-10-31.4'), 'web-2026-10-31.4');
assert.equal(recordedConsentVersion('web-2026-10-31.3'), 'web-2026-10-31.3');
// Unknown / forged versions are refused (caller answers 400), never stored.
for (const bad of ['web-2026-10-31.5', 'v', 'web-2026-10-31.2', '.4']) assert.equal(recordedConsentVersion(bad), null, bad);

// auth.service stores the resolved client version, not the server constant.
const svc = readFileSync(join(__dirname, '../../modules/auth/auth.service.ts'), 'utf8');
assert.match(svc, /recordedConsentVersion\(dto\.consentVersion\)/);
assert.doesNotMatch(svc, /consentVersion:\s*CONSENT_VERSION/);
assert.match(svc, /consent_version_unknown/);

// Pairing with the payments-02 learner (when the worktree is present): it sends CONSENT_VERSION .4 and shows the .4 labels.
const learner = process.env.LEARNER_SRC ?? '/workspace/wt-pay-learner/apps/web-learner/src';
const sc = join(learner, 'components/safety/signupConsent.ts');
if (existsSync(sc)) {
  const t = readFileSync(sc, 'utf8');
  assert.match(t, /export const CONSENT_VERSION = 'web-2026-10-31\.4'/);
  for (const l of ['uz', 'ru', 'en'] as const) assert.ok(t.includes(CONSENT_LABELS[l]), `learner ${l} label = API .4 label`);
  const auth = readFileSync(join(learner, 'pages/AuthPage.tsx'), 'utf8');
  assert.match(auth, /consentVersion:\s*CONSENT_VERSION/, 'AuthPage sends the version it displayed');
} else console.log('consent-version: learner pairing SKIP (no learner worktree)');
console.log('consent-version: OK');
