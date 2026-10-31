import * as assert from 'node:assert/strict';
import { ageBand, ageFromBirthYear, canMessage, needsAgePrompt, unknownAgeBand } from './age-policy';
import { CONSENT_LABELS, consentRequired } from './consent';
import { readFileSync } from 'node:fs';
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
// Consent labels are verbatim from PM's README (if the file is present in this checkout).
const readme = process.env.LEGAL_README ?? join(__dirname, '../../../../../../gotcha-handoff/team/pm/legal/web/README.md');
try {
  const md = readFileSync(readme, 'utf8');
  for (const [l, label] of Object.entries(CONSENT_LABELS)) assert.ok(md.includes(label), `consent label ${l} drifted from README`);
  console.log('consent labels match README');
} catch (e) {
  if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
}
assert.equal(consentRequired('web'), true);
assert.equal(consentRequired(undefined), true);
assert.equal(consentRequired('android'), false);
// WL4-03: the android flag can't skip consent from a browser (Origin present).
assert.equal(consentRequired('android', 'https://app.gotchaa.uz'), true);
assert.equal(consentRequired('android', 'http://localhost:5173'), true);
assert.equal(consentRequired('android', ''), false);
console.log('safety: OK');
