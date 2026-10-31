import * as assert from 'node:assert/strict';
import { ageBand, ageFromBirthYear, canMessage, needsAgePrompt, unknownAgeBand } from './age-policy';
import { CONSENT_LABELS, CONSENT_VERSION, consentRequired } from './consent';
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
// 31 Oct 15:24: pre-oferta consent copy, word for word; no Public Offer; version bumped from web-2026-10-31.2.
assert.equal(CONSENT_VERSION, 'web-2026-10-31.3');
assert.deepEqual(CONSENT_LABELS, {
  en: 'I have read and accept the Terms of Use and the Privacy Policy, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA.',
  ru: 'Я прочитал(а) и принимаю Условия использования и Политику конфиденциальности, включая передачу текста для AI-функций (например, слова с его предложением или переводимых мной сообщений чата) в OpenAI в США.',
  uz: 'Foydalanish shartlari va Maxfiylik siyosati bilan tanishdim va ularni qabul qilaman, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap yoki men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman.',
});
for (const label of Object.values(CONSENT_LABELS)) assert.ok(!/offer|oferta|оферт/i.test(label), 'no Public Offer in consent');
assert.ok(CONSENT_LABELS.uz.includes('so\u02bbz') && CONSENT_LABELS.uz.includes('OpenAI\u02bcga'), 'uz uses U+02BB / U+02BC');
assert.equal(consentRequired('web'), true);
assert.equal(consentRequired(undefined), true);
assert.equal(consentRequired('android'), false);
// WL4-03: the android flag can't skip consent from a browser (Origin present).
assert.equal(consentRequired('android', 'https://app.gotchaa.uz'), true);
assert.equal(consentRequired('android', 'http://localhost:5173'), true);
assert.equal(consentRequired('android', ''), false);
console.log('safety: OK');
