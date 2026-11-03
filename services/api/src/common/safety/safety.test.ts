import * as assert from 'node:assert/strict';
import { ageBand, ageFromBirthYear, canMessage, needsAgePrompt, unknownAgeBand } from './age-policy';
import { CONSENT_LABELS, CONSENT_VERSION, consentRequired } from './consent';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const now = new Date('2026-10-31T00:00:00Z');
assert.equal(ageFromBirthYear(2010, now), 15);
assert.equal(ageBand(2016, now, {}), 'under13');
assert.equal(ageBand(2010, now, {}), 'teen');
assert.equal(ageBand(1990, now, {}), 'adult');
assert.equal(ageBand(2008, now, {}), 'teen'); // 17 or 18: younger bound
// Unknown age defaults to 13-17 limits, configurable.
assert.equal(ageBand(null, now, {}), 'teen');
assert.equal(ageBand(null, now, { AGE_UNKNOWN_BAND: 'under13' }), 'under13');
assert.equal(unknownAgeBand({ AGE_UNKNOWN_BAND: 'bogus' }), 'teen');
// One-time prompt.
assert.equal(needsAgePrompt({ birthYear: null, agePromptedAt: null }), true);
assert.equal(needsAgePrompt({ birthYear: null, agePromptedAt: new Date() }), false);
assert.equal(needsAgePrompt({ birthYear: 2000, agePromptedAt: null }), false);
// Messaging gate.
assert.equal(canMessage('under13', 'adult', true), false);
assert.equal(canMessage('adult', 'under13', true), false);
assert.equal(canMessage('teen', 'adult', false), false);
assert.equal(canMessage('teen', 'teen', true), true);
assert.equal(canMessage('adult', 'adult', false), true);
// Expected labels come from the PM README 'Sign-up tick-box labels' section matching the shipped version:
// .3 = CURRENT (pre-oferta), .4 = PENDING (payments-02 under G1: Terms + Privacy + Public Offer).
assert.equal(CONSENT_VERSION, 'web-2026-10-31.4');
assert.ok(CONSENT_LABELS.uz.includes('so\u02bbz') && CONSENT_LABELS.uz.includes('OpenAI\u02bcga'), 'uz uses U+02BB / U+02BC');
assert.equal(consentRequired('web'), true);
assert.equal(consentRequired(undefined), true);
assert.equal(consentRequired('android'), false);
assert.equal(consentRequired('android', 'https://app.gotchaa.uz'), true);
assert.equal(consentRequired('android', 'http://localhost:5173'), true);
assert.equal(consentRequired('android', ''), false);
const legalDir = process.env.LEGAL_DRAFTS_DIR ?? join(__dirname, '../../../../../legal/web');
const readmePath = join(legalDir, 'README.md');
if (!existsSync(readmePath)) {
  console.log('safety.test: label compare SKIP (no legal README)');
  process.exit(0);
}
const readme = readFileSync(readmePath, 'utf8').replace(/\r/g, '');
const section = readme.split('## Sign-up tick-box labels')[1].split('\n## ')[0];
const shipped = CONSENT_VERSION === 'web-2026-10-31.3' ? 'CURRENT' : 'PENDING';
const part = section.split('**' + shipped)[1].split(shipped === 'CURRENT' ? '**PENDING' : '\u0000')[0];
const expected: Record<string, string> = {};
for (const m of part.matchAll(/^- (?:\(pending\) )?\*\*(uz|ru|en):\*\* (.+)$/gm)) expected[m[1]] = m[2].trim();
assert.deepEqual(Object.keys(expected).sort(), ['en', 'ru', 'uz']);
assert.equal(CONSENT_VERSION, 'web-2026-10-31.4');
assert.equal(shipped, 'PENDING');
assert.deepEqual({ ...CONSENT_LABELS }, expected);
for (const label of Object.values(CONSENT_LABELS)) assert.ok(/Public Offer|Публичную оферту|Ommaviy oferta/.test(label), '3-document label names the Public Offer');
console.log('safety: OK');
