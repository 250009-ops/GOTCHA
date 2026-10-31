// S3 sign-up tick-box, pre-oferta version (PM 31 Oct 15:24, word for word; API CONSENT_VERSION web-2026-10-31.3).
// Run: node tests/consent-labels.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const WANT = {
  en: 'I have read and accept the Terms of Use and the Privacy Policy, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA.',
  ru: 'Я прочитал(а) и принимаю Условия использования и Политику конфиденциальности, включая передачу текста для AI-функций (например, слова с его предложением или переводимых мной сообщений чата) в OpenAI в США.',
  uz: 'Foydalanish shartlari va Maxfiylik siyosati bilan tanishdim va ularni qabul qilaman, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap yoki men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman.',
};
const { CONSENT_LABELS, CONSENT_LINK_PHRASES, consentParts } = await import('../src/components/safety/signupConsent.ts');
assert.deepEqual(CONSENT_LABELS, WANT);
assert.ok(CONSENT_LABELS.uz.includes('so\u02bbz') && CONSENT_LABELS.uz.includes('OpenAI\u02bcga'), 'uz U+02BB / U+02BC');
for (const l of ['uz', 'ru', 'en']) {
  assert.ok(!/offer|oferta|оферт/i.test(CONSENT_LABELS[l]), `${l}: no Public Offer`);
  const parts = consentParts(l);
  assert.equal(parts.map((p) => p.text).join(''), WANT[l], `${l}: rendered text is the exact label`);
  assert.deepEqual(parts.filter((p) => p.link).map((p) => [p.link, p.text]), [['terms', CONSENT_LINK_PHRASES[l].terms], ['privacy', CONSENT_LINK_PHRASES[l].privacy]], l);
}
// The API's labels and version must match (same repo layout as the bundle).
const api = readFileSync(process.env.API_CONSENT_TS ?? '/workspace/wlive/services/api/src/common/safety/consent.ts', 'utf8');
assert.ok(api.includes("CONSENT_VERSION = 'web-2026-10-31.3'"), 'API version bumped');
for (const l of ['uz', 'ru', 'en']) assert.ok(api.includes(WANT[l]), `API label ${l} matches`);
console.log('consent labels (pre-oferta, web-2026-10-31.3) exact, links terms+privacy only: OK');
