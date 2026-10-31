// landing-premium-01: copy guards. Run: node --experimental-strip-types --test tests/landing-copy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { LANDING_COPY } from '../src/lib/landingCopy.ts';
import { plusCta } from '../src/lib/plusCta.ts';

// 'No daily limit on word lookups' is Marketing's FINAL Plus wording (LANDING-COPY-v2 14:33:59), so it is no longer banned.
const BANNED = [/unlimited/i, /fair use/i, /offline/i, /subscription/i, /13\+/, /\$/, /USD/, /безлим/i, /cheksiz/i, /подписк/i, /obuna/i];
for (const l of ['uz', 'ru', 'en'] as const) {
  const C = LANDING_COPY[l];
  // plusNote carries the PM-approved negation 'No subscription, no auto-renewal' (LP1-06), checked verbatim below.
  const all = JSON.stringify({ ...C, plusNote: '' });
  test(`${l}: no banned claims`, () => { for (const re of BANNED) assert.doesNotMatch(all, re); });
  test(`${l}: LP1-06 plusNote line verbatim`, () => {
    const NOTE = { en: 'One-time payment. No subscription, no auto-renewal.', uz: 'Bir martalik toʻlov. Obuna yoʻq, avtomatik yangilanmaydi.', ru: 'Разовый платёж. Без подписки и автопродления.' }[l];
    assert.ok(C.plusNote.startsWith(NOTE), C.plusNote);
  });
  test(`${l}: Plus copy = LANDING-COPY-v2 FINAL (no daily lookup limit on Plus, Free 20)`, () => {
    assert.equal(C.plusT, 'Gotcha Plus');
    assert.equal(C.plusB.length, 3);
    assert.match(C.plusLead, /\b20\b/); assert.match(C.plusB[0], /\b20\b/);
    assert.match(C.plusB[1], /200/); assert.match(C.plusB[1], /\b10\b/); // quiz bullet, behind VITE_PLUS_QUIZ_CAP_LIVE
    if (l === 'en') { assert.equal(C.plusB[0], 'No daily limit on word lookups (20 on Free)'); assert.equal(C.plusB[2], 'Everything in Free stays included'); }
    if (l === 'en') { assert.ok(C.plusPrice.every((p) => p.includes('soʻm'))); }
    assert.match(C.plusPrice[0], /24[ ,]990/); assert.match(C.plusPrice[1], /199[ ,]990/);
    assert.match(C.plusOpt, /50%/);
  });
  test(`${l}: no Android FAQ, 5 items`, () => {
    assert.doesNotMatch(all, /Android/i);
    assert.equal(C.faq_questions.length, 5); assert.equal(C.faq_answers.length, 5);
  });
  test(`${l}: Plus CTA, checkout off (default)`, () => {
    const pc = plusCta(C, false, l);
    assert.equal(pc.label, C.plusCta_prelaunch); assert.equal(pc.note, C.plusNote_prelaunch); assert.equal(pc.live, false);
    const u = new URL(pc.href);
    assert.match(u.pathname, /\/register$/); assert.equal(u.searchParams.get('ui'), l);
    assert.notEqual(pc.label, C.plusCta);
  });
  test(`${l}: Plus CTA, checkout on`, () => {
    const pc = plusCta(C, true, l);
    assert.equal(pc.label, C.plusCta); assert.equal(pc.note, C.plusNote); assert.equal(pc.live, true);
    assert.equal(new URL(pc.href).searchParams.get('ui'), l);
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
test('pre-launch copy verbatim from LANDING-COPY-v2', () => {
  assert.equal(LANDING_COPY.en.plusCta_prelaunch, 'Start free');
  assert.equal(LANDING_COPY.uz.plusCta_prelaunch, 'Bepul boshlash');
  assert.equal(LANDING_COPY.ru.plusCta_prelaunch, 'Начать бесплатно');
  assert.equal(LANDING_COPY.en.plusNote_prelaunch, 'You can start on Free today. Plus payment opens on the site soon.');
  assert.equal(LANDING_COPY.uz.plusNote_prelaunch, 'Hozir bepul tarifda boshlang. Plus uchun to\u02bblov saytda tez orada ochiladi.');
  assert.equal(LANDING_COPY.ru.plusNote_prelaunch, 'Начните с бесплатного плана уже сейчас. Оплата Plus скоро появится на сайте.');
});
test('lookup: real uz capture, only the agreed edits; no ru/en glosses typed in', () => {
  const cap = JSON.parse(readFileSync(new URL('../src/data/lookup-capture.json', import.meta.url), 'utf8'));
  const raw = JSON.parse(readFileSync(new URL('../src/data/lookup-capture-hesitation-uz.raw.json', import.meta.url), 'utf8'));
  assert.equal(cap.captured, true);
  assert.equal(cap.byLang.uz.lemma, raw.lemma);
  assert.equal(cap.byLang.uz.contextualMeaning, raw.contextualMeaning.replace(/\u2018/g, '\u02bb'));
  assert.equal(raw.translation, 'ikkilanmoq'); assert.equal(cap.byLang.uz.translation, 'ikkilanish');
  assert.equal(cap.byLang.en, null); assert.equal(cap.byLang.ru, null);
});

test('UX fixes: localised burger labels, dialog, self-hosted Bagel, webp covers', () => {
  const src = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  for (const s of ['Close menu', 'Menyuni yopish', 'Закрыть меню', "menu: 'Menyu'", "menu: 'Меню'", 'role="dialog"', 'aria-modal="true"', "'Escape'", "inert"]) {
    assert.ok(src.includes(s), s);
  }
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!html.includes('Bagel'), 'no Google Bagel');
  assert.ok(existsSync(new URL('../public/fonts/bagel-fat-one-latin.woff2', import.meta.url)));
  const covers = readdirSync(new URL('../public/landing/covers/', import.meta.url));
  for (const j of covers.filter((f) => f.endsWith('.jpg'))) for (const w of [240, 480]) assert.ok(covers.includes(j.replace('.jpg', `-${w}.webp`)), j + w);
});

test('P2: no Google Fonts; Manrope self-hosted; header switcher hidden while burger open', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(!/fonts\.googleapis|fonts\.gstatic/.test(html));
  assert.ok(existsSync(new URL('../public/fonts/manrope-subset.woff2', import.meta.url)));
  const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');
  assert.ok(css.includes('manrope-subset.woff2') && !/Geist|Sora/.test(css));
  for (const f of ['../src/pages/LegalPage.tsx', '../src/components/SiteChrome.tsx']) assert.ok(!/Geist|Sora|Inter'/.test(readFileSync(new URL(f, import.meta.url), 'utf8')), f);
  assert.ok(readFileSync(new URL('../src/landing-premium.css', import.meta.url), 'utf8').includes('.nav.menu-open .ls{visibility:hidden}'));
});

test('final-6.1: legal stays on f098ee8 (PM legalPm + check-legal); landing-premium legal-V2 path not reintroduced', () => {
  for (const p of ['../src/lib/legalHtml.generated.ts', '../src/pages/LegalV2Page.tsx', '../scripts/legal-guard.mjs', '../legal-src']) assert.ok(!existsSync(new URL(p, import.meta.url)), p);
  const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
  for (const r of ['path="/privacy"', 'path="/terms"', 'path="/oferta"']) assert.ok(app.includes(r), r);
  assert.ok(readFileSync(new URL('../src/components/SiteChrome.tsx', import.meta.url), 'utf8').includes('to="/oferta"'), 'footer keeps the /oferta link');
  assert.ok(readFileSync(new URL('../index.html', import.meta.url), 'utf8').includes('<meta name="color-scheme" content="light" />'));
});

test('uz web copy: no plain/curly apostrophes inside words (ʻ/ʼ only)', () => {
  const m = readFileSync(new URL('../src/lib/marketingCopy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(m, /\p{L}[’‘]\p{L}/u);
  for (const v of Object.values(LANDING_COPY.uz).flat(3)) if (typeof v === 'string') assert.doesNotMatch(v, /\p{L}['’‘]\p{L}/u, v);
});

test('landing copy: no unlimited / fair use / cheksiz / безлим / 200 word lookups / 500 / trial; dictionary-fallback removed', () => {
  const page = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /DICT_FALLBACK|plusLeadDict|plusB0Dict/);
  assert.match(page, /QUIZ_CAP_LIVE = import\.meta\.env\.VITE_PLUS_QUIZ_CAP_LIVE === 'true'/);
  const src = readFileSync(new URL('../src/lib/landingCopy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /unlimited|fair use|cheksiz|безлим|200 word lookups|then dictionary|\b500\b|trial|sinov|пробн/i);
});

test('popover close is an inline SVG, not a text glyph', () => {
  const page = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /✕/);
  assert.match(page, /aria-label=\{P\.close\}><svg/);
});

test('footer build stamp: only with VITE_PREVIEW_STAMP=true (build:publish rejects it, PAY2-14)', () => {
  const page = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /PREVIEW_STAMP = import\.meta\.env\.VITE_PREVIEW_STAMP === 'true'/);
  assert.match(page, /\{PREVIEW_STAMP && BUILD_COMMIT/);
  assert.doesNotMatch(page, /VITE_LEGAL_V2/);
});

test('Manrope subset covers every non-ASCII codepoint in the shipped copy', async () => {
  const { execFileSync } = await import('node:child_process');
  const cps = new Set(execFileSync('python3', ['-c', "from fontTools.ttLib import TTFont;print(' '.join(str(c) for c in TTFont('public/fonts/manrope-subset.woff2').getBestCmap()))"], { cwd: new URL('..', import.meta.url) }).toString().trim().split(' ').map(Number));
  const files = ['../src/lib/landingCopy.ts', '../src/lib/marketingCopy.ts', '../src/pages/LandingPage.tsx', '../src/components/GotchaLogo.tsx'];
  const missing = new Set<string>();
  for (const f of files) for (const ch of readFileSync(new URL(f, import.meta.url), 'utf8')) { const c = ch.codePointAt(0)!; if (c >= 0x20 && !cps.has(c)) missing.add('U+' + c.toString(16).toUpperCase().padStart(4, '0')); }
  assert.deepEqual([...missing], []);
  assert.ok(cps.has(0x2248) && cps.has(0x2265));
});
