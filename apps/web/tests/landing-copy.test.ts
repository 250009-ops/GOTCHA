// landing-premium-01: copy guards. Run: node --experimental-strip-types --test tests/landing-copy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { LANDING_COPY } from '../src/lib/landingCopy.ts';
import { plusCta } from '../src/lib/plusCta.ts';

const BANNED = [/unlimited/i, /no daily limit/i, /offline/i, /subscription/i, /13\+/, /\$/, /USD/, /безлимит/i, /cheksiz/i, /подписк/i, /obuna/i];
for (const l of ['uz', 'ru', 'en'] as const) {
  const C = LANDING_COPY[l];
  // plusNote carries the PM-approved negation 'No subscription, no auto-renewal' (LP1-06), checked verbatim below.
  const all = JSON.stringify({ ...C, plusNote: '' });
  test(`${l}: no banned claims`, () => { for (const re of BANNED) assert.doesNotMatch(all, re); });
  test(`${l}: LP1-06 plusNote line verbatim`, () => {
    const NOTE = { en: 'One-time payment. No subscription, no auto-renewal.', uz: 'Bir martalik toʻlov. Obuna yoʻq, avtomatik yangilanmaydi.', ru: 'Разовый платёж. Без подписки и автопродления.' }[l];
    assert.ok(C.plusNote.startsWith(NOTE), C.plusNote);
  });
  test(`${l}: Plus copy: unlimited lookups (14:32) => no Plus lookup number shipped by default`, () => {
    assert.equal(C.plusT, 'Gotcha Plus');
    assert.equal(C.plusB.length, 3);
    // Slots awaiting Marketing's new lines: empty = hidden.
    assert.equal(C.plusLead, ''); assert.equal(C.plusB[0], '');
    assert.match(C.plusB[1], /200/); assert.match(C.plusB[1], /\b10\b/); // quiz bullet, behind VITE_PLUS_QUIZ_CAP_LIVE
    assert.ok(C.plusB[2].length > 0); // "Everything in Free stays included"
    assert.match(C.plusB0Dict, /200/); assert.match(C.plusLeadDict, /200/); // dictionary-fallback lines, flag-off
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
  for (const f of ['../src/pages/LegalV2Page.tsx', '../src/components/SiteChrome.tsx']) assert.ok(!/Geist|Sora|Inter'/.test(readFileSync(new URL(f, import.meta.url), 'utf8')), f);
  assert.ok(readFileSync(new URL('../src/landing-premium.css', import.meta.url), 'utf8').includes('.nav.menu-open .ls{visibility:hidden}'));
});

test('legal: canonical PM HTML verbatim, publish guard, oferta unlinked', async () => {
  const { LEGAL_HTML_V2 } = await import('../src/lib/legalHtml.generated.ts');
  // @ts-expect-error plain .mjs
  const { legalPublishProblems } = await import('../scripts/legal-guard.mjs');
  for (const l of ['uz', 'ru', 'en'] as const) for (const d of ['privacy', 'terms', 'oferta'] as const) {
    const html: string = LEGAL_HTML_V2[l][d];
    assert.equal(html, readFileSync(new URL(`../legal-src/${d}-${l}.html`, import.meta.url), 'utf8'), `${d}-${l} verbatim`);
    assert.ok(!/gotcha\.app|privacy@|Gotcha Language Learning|Inc\./.test(html), `${d}-${l} contacts`);
    assert.deepEqual([...new Set(html.match(/[\w.+-]+@[\w.-]+\.\w+/g) ?? [])], ['support@gotchaa.uz'], `${d}-${l} only support@`);
    if (l === 'uz') assert.ok(!/\p{L}['‘’]\p{L}/u.test(html), `${d}-uz uses ʻ/ʼ only`);
  }
  const src = readFileSync(new URL('../src/lib/legalHtml.generated.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('[EFFECTIVE DATE]'));
  assert.ok(legalPublishProblems({ mode: 'production', qaBuild: false, legalSource: src }).some((p: string) => p.includes('[EFFECTIVE DATE]')), 'prod build blocked');
  const prod = legalPublishProblems({ mode: 'production', qaBuild: false, legalSource: src }).join('\n');
  for (const ph of ['[EFFECTIVE DATE]', '[OFERTA URL]', 'NOT PUBLISHED']) assert.ok(prod.includes(ph), ph);
  assert.equal(legalPublishProblems({ mode: 'production', qaBuild: false, legalSource: '<p>Seller [SELLER LEGAL NAME]</p>' }).length, 1, 'any [ALLCAPS] placeholder');
  assert.equal(legalPublishProblems({ mode: 'production', qaBuild: false, legalSource: '<p>[EFFECTIVE DATE] and [OFERTA URL]</p>' }).length, 2);
  assert.equal(legalPublishProblems({ mode: 'production', qaBuild: true, legalSource: src }).length, 0, 'QA build allowed');
  assert.equal(legalPublishProblems({ mode: 'production', qaBuild: false, legalSource: '<p>Effective date: 1 Dec 2026</p>' }).length, 0);
  for (const f of ['../src/components/SiteChrome.tsx', '../src/pages/LandingPage.tsx']) assert.ok(!readFileSync(new URL(f, import.meta.url), 'utf8').includes('oferta'), `${f} must not link /oferta`);
  assert.ok(readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8').includes('path="/oferta"'));
  assert.ok(readFileSync(new URL('../src/pages/LegalV2Page.tsx', import.meta.url), 'utf8').includes('QA_BUILD && ('));
});

test('uz web copy: no plain/curly apostrophes inside words (ʻ/ʼ only)', () => {
  const m = readFileSync(new URL('../src/lib/marketingCopy.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(m, /\p{L}[’‘]\p{L}/u);
  for (const v of Object.values(LANDING_COPY.uz).flat(3)) if (typeof v === 'string') assert.doesNotMatch(v, /\p{L}['’‘]\p{L}/u, v);
});

test('Plus render: flags default off; no 500 cap, no trial; lead/bullets pluggable', () => {
  const page = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /DICT_FALLBACK_LIVE = import\.meta\.env\.VITE_PLUS_DICT_FALLBACK_LIVE === 'true'/);
  assert.match(page, /QUIZ_CAP_LIVE = import\.meta\.env\.VITE_PLUS_QUIZ_CAP_LIVE === 'true'/);
  assert.match(page, /\.filter\(Boolean\)/);
  for (const l of ['uz', 'ru', 'en'] as const) {
    const c = LANDING_COPY[l];
    const t = [c.plusT, c.plusLead, ...c.plusB, c.plusOpt, c.plusNote, c.plusLeadDict, c.plusB0Dict].join(' ');
    assert.doesNotMatch(t, /\b500\b|trial|sinov|пробн|unlimited|cheksiz|безлимит/i, l);
  }
});

test('popover close is an inline SVG, not a text glyph', () => {
  const page = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /✕/);
  assert.match(page, /aria-label=\{P\.close\}><svg/);
});

test('footer build stamp: only with VITE_PREVIEW_STAMP=true on a QA build; production build blocked', async () => {
  const page = readFileSync(new URL('../src/pages/LandingPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /PREVIEW_STAMP = import\.meta\.env\.VITE_PREVIEW_STAMP === 'true' && import\.meta\.env\.VITE_LEGAL_V2 === 'true'/);
  assert.match(page, /\{PREVIEW_STAMP && BUILD_COMMIT/);
  const { previewStampProblems } = await import('../scripts/legal-guard.mjs');
  assert.equal(previewStampProblems({ mode: 'production', qaBuild: false, previewStamp: 'true' }).length, 1);
  assert.equal(previewStampProblems({ mode: 'production', qaBuild: false, previewStamp: undefined }).length, 0);
  assert.equal(previewStampProblems({ mode: 'production', qaBuild: true, previewStamp: 'true' }).length, 0);
});

test('Manrope subset covers every non-ASCII codepoint in the shipped copy', async () => {
  const { execFileSync } = await import('node:child_process');
  const cps = new Set(execFileSync('python3', ['-c', "from fontTools.ttLib import TTFont;print(' '.join(str(c) for c in TTFont('public/fonts/manrope-subset.woff2').getBestCmap()))"], { cwd: new URL('..', import.meta.url) }).toString().trim().split(' ').map(Number));
  const files = ['../src/lib/landingCopy.ts', '../src/lib/marketingCopy.ts', '../src/lib/legalHtml.generated.ts', '../src/pages/LandingPage.tsx', '../src/components/GotchaLogo.tsx'];
  const missing = new Set<string>();
  for (const f of files) for (const ch of readFileSync(new URL(f, import.meta.url), 'utf8')) { const c = ch.codePointAt(0)!; if (c >= 0x20 && !cps.has(c)) missing.add('U+' + c.toString(16).toUpperCase().padStart(4, '0')); }
  assert.deepEqual([...missing], []);
  assert.ok(cps.has(0x2248) && cps.has(0x2265));
});
