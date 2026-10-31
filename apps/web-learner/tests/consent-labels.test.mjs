// S3 sign-up tick-box, payments-02 (G1) version: the label is VERBATIM the README section 'Sign-up tick-box labels'
// that matches the shipped state (.3 → CURRENT, anything newer → PENDING); API CONSENT_VERSION web-2026-10-31.4.
// Run: node tests/consent-labels.test.mjs   (LEGAL_DRAFTS_DIR / API_CONSENT_TS override the default paths)
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const SHIPPED_VERSION = 'web-2026-10-31.4';
const readme = readFileSync(`${process.env.LEGAL_DRAFTS_DIR ?? '/workspace/gotcha-handoff/team/pm/legal/web'}/README.md`, 'utf8');
const sec = readme.slice(readme.indexOf('## Sign-up tick-box labels'), readme.indexOf('## Must ship'));
const part = SHIPPED_VERSION.endsWith('.3') ? sec.slice(sec.indexOf('**CURRENT'), sec.indexOf('**PENDING')) : sec.slice(sec.indexOf('**PENDING'));
const WANT = Object.fromEntries([...part.matchAll(/^- (?:\(pending\) )?\*\*(uz|ru|en):\*\* (.+)$/gm)].map((m) => [m[1], m[2].trim()]));
assert.deepEqual(Object.keys(WANT).sort(), ['en', 'ru', 'uz'], 'README section parsed');
const { CONSENT_LABELS, CONSENT_LINK_PHRASES, consentParts } = await import('../src/components/safety/signupConsent.ts');
assert.deepEqual(CONSENT_LABELS, WANT);
assert.ok(CONSENT_LABELS.uz.includes('so\u02bbz') && CONSENT_LABELS.uz.includes('OpenAI\u02bcga'), 'uz U+02BB / U+02BC');
for (const l of ['uz', 'ru', 'en']) {
  const parts = consentParts(l);
  assert.equal(parts.map((p) => p.text).join(''), WANT[l], `${l}: rendered text is the exact label`);
  assert.deepEqual(parts.filter((p) => p.link).map((p) => [p.link, p.text]),
    [['terms', CONSENT_LINK_PHRASES[l].terms], ['privacy', CONSENT_LINK_PHRASES[l].privacy], ['oferta', CONSENT_LINK_PHRASES[l].oferta]], l);
}
// The paired API (payments-02-wlive) must carry the same labels and version.
const api = readFileSync(process.env.API_CONSENT_TS ?? '/workspace/wt-pay-wlive/services/api/src/common/safety/consent.ts', 'utf8');
assert.ok(api.includes(`CONSENT_VERSION = '${SHIPPED_VERSION}'`), 'API version matches');
for (const l of ['uz', 'ru', 'en']) assert.ok(api.includes(WANT[l]), `API label ${l} matches`);
console.log(`consent labels (${SHIPPED_VERSION}, README PENDING) exact, links terms+privacy+oferta: OK`);
