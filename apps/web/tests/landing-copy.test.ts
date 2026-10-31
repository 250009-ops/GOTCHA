// landing-premium-01: copy guards. Run: node --experimental-strip-types --test tests/landing-copy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { LANDING_COPY } from '../src/lib/landingCopy.ts';

const BANNED = [/unlimited/i, /no daily limit/i, /offline/i, /subscription/i, /13\+/, /\$/, /USD/, /безлимит/i, /cheksiz/i, /подписк/i, /obuna/i];
for (const l of ['uz', 'ru', 'en'] as const) {
  const C = LANDING_COPY[l];
  const all = JSON.stringify(C);
  test(`${l}: no banned claims`, () => { for (const re of BANNED) assert.doesNotMatch(all, re); });
  test(`${l}: Plus = 2 bullets, approved prices, 200/50`, () => {
    assert.equal(C.plusB.length, 2);
    assert.match(C.plusB[0], /200/); assert.match(C.plusB[0], /50/);
    assert.match(C.plusPrice[0], /24[ ,]990/); assert.match(C.plusPrice[1], /199[ ,]990/);
    assert.match(C.plusOpt, /50%/);
  });
  test(`${l}: support email`, () => assert.match(C.contactLine, /support@gotchaa\.uz/));
}
test('uz keeps U+02BB, no ASCII apostrophe', () => {
  const s = JSON.stringify(LANDING_COPY.uz);
  assert.ok(s.includes('\u02bb'));
  assert.ok(!s.includes("'"));
});
test('entity names', () => {
  assert.equal(LANDING_COPY.uz.entity, 'Erkin Tizim jamoasi');
  assert.equal(LANDING_COPY.ru.entity, 'команда Erkin Tizim');
  assert.equal(LANDING_COPY.en.entity, 'the Erkin Tizim team');
});
test('switcher order UZ / ENG / RU', () => {
  const src = readFileSync(new URL('../src/components/LandingLangSwitch.tsx', import.meta.url), 'utf8');
  const i = ['short: \'UZ\'', 'short: \'ENG\'', 'short: \'RU\''].map((k) => src.indexOf(k));
  assert.ok(i[0] > 0 && i[0] < i[1] && i[1] < i[2], String(i));
});
test('page renders no stats / learnerCount / topReaders', () => {
  const src = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /learnerCount|topReaders|fetchMarketingLanding/);
});
test('JSON-LD: Web only, no offers', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /Android/); assert.doesNotMatch(html, /"offers"/);
  assert.match(html, /"operatingSystem": "Web"/);
});
