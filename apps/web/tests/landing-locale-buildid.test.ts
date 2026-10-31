// final-6.1 (QA live pass 1): S3c ?ui=/?lang= + switcher translate, persist, update links and <html lang>; S4 footer build id.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localeFromQuery, queryWithLocale, buildId } from '../src/lib/queryLocale.ts';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

for (const l of ['uz', 'ru', 'en'] as const) {
  test(`S3c: ?ui=${l} and ?lang=${l} select ${l}`, () => {
    assert.equal(localeFromQuery(new URLSearchParams(`ui=${l}`)), l);
    assert.equal(localeFromQuery(new URLSearchParams(`lang=${l}`)), l);
    assert.equal(localeFromQuery(new URLSearchParams(`ui=${l.toUpperCase()}`)), l);
  });
}
test('S3c: lang wins over ui; unknown values ignored', () => {
  assert.equal(localeFromQuery(new URLSearchParams('lang=ru&ui=en')), 'ru');
  assert.equal(localeFromQuery(new URLSearchParams('ui=de')), null);
  assert.equal(localeFromQuery(new URLSearchParams('')), null);
});
test('S3c: switcher pick rewrites lang and ui together, keeps other params', () => {
  const p = queryWithLocale(new URLSearchParams('ui=uz&utm_source=x'), 'en');
  assert.equal(p.get('lang'), 'en'); assert.equal(p.get('ui'), 'en'); assert.equal(p.get('utm_source'), 'x');
  assert.equal(queryWithLocale(new URLSearchParams(''), 'ru').has('ui'), false);
});
test('S3c: detection uses ?lang/?ui, query choice is persisted, <html lang> follows, switcher uses queryWithLocale', () => {
  assert.match(read('../src/lib/webLocale.ts'), /const fromQuery = localeFromQuery\(searchParams\)/);
  const ctx = read('../src/lib/webLocaleContext.tsx');
  assert.match(ctx, /if \(fromQuery\) persistWebLocale\(fromQuery\)/);
  assert.match(ctx, /document\.documentElement\.lang = copyLocale/);
  const page = read('../src/pages/LandingPage.tsx');
  assert.match(page, /setParams\(queryWithLocale\(params, c\)/);
  assert.match(page, /setLocale\(c\)/);
  assert.match(page, /registerUrl\(\{ plan: 'free', from: 'landing', ui \}\)/);
  assert.match(page, /href=\{`\/privacy\?lang=\$\{L\}`\}/);
});
test('S4: footer build id = short sha · date, always rendered when known', () => {
  assert.equal(buildId('989e0a0', '2026-10-31'), '989e0a0 · 2026-10-31');
  assert.equal(buildId('', ''), '');
  const page = read('../src/pages/LandingPage.tsx');
  assert.match(page, /\{BUILD_ID && <div className="build-id"/);
  const cfg = read('../vite.config.ts');
  assert.match(cfg, /VITE_BUILD_COMMIT \|\|= git\('git rev-parse --short=7 HEAD'\)/);
  assert.match(cfg, /VITE_BUILD_DATE \|\|= git\('git log -1 --format=%cs HEAD'\)/);
});

test("WLF-30: web-shipped Uzbek names use ʻ (U+02BB), never ASCII ' (O'zbekcha)", () => {
  const meta = read('../../../packages/shared/src/uiLanguagePickerMeta.ts');
  assert.ok(meta.includes("nativeName: 'O\u02bbzbekcha'"));
  for (const f of [meta, read('../src/lib/landingCopy.ts'), read('../src/components/LandingLangSwitch.tsx')]) assert.doesNotMatch(f, /O'zbek/);
});
