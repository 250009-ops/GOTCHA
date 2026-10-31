import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// WLF-07 (final-3): /terms and /privacy must serve the PM's current drafts (team/pm/legal/web), not legacy copy.
const PM = process.env.LEGAL_PM_DIR || '/workspace/gotcha-handoff/team/pm/legal/web';
const DOCS = ['terms', 'privacy'] as const;
const LOCALES = ['en', 'ru', 'uz'] as const;
const OLD = [/non-refundable/i, /parental or guardian permission/i, /United States or any other country/i, /Terms of Service/, /Xizmat ko'rsatish/, /невозвратн/i];

test('WLF-07: vendored legal-pm/*.html are byte-identical to the PM files (not pending-payments-02)', () => {
  assert.ok(existsSync(PM), `PM legal dir missing: ${PM} (set LEGAL_PM_DIR)`);
  for (const d of DOCS) for (const l of LOCALES) {
    const mine = readFileSync(`legal-pm/${d}-${l}.html`, 'utf8');
    assert.equal(mine, readFileSync(join(PM, `${d}-${l}.html`), 'utf8'), `${d}-${l} drifted from PM; run npm run legal:sync`);
    assert.notEqual(mine, existsSync(join(PM, 'pending-payments-02', `${d}-${l}.html`)) ? readFileSync(join(PM, 'pending-payments-02', `${d}-${l}.html`), 'utf8') : '', `${d}-${l} is the pending-payments-02 copy`);
    assert.ok(!mine.includes('<!--'), `${d}-${l} has an HTML comment`);
    for (const re of OLD) assert.ok(!re.test(mine), `${d}-${l} has legacy text ${re}`);
  }
});

test('WLF-07: pages render legal-pm via legalPm.ts; legacy legalCopy is gone', () => {
  const page = readFileSync('src/pages/LegalPage.tsx', 'utf8');
  assert.match(page, /legalHtml\(doc, locale\)/);
  assert.ok(!existsSync('src/lib/legalCopy.ts') && !existsSync('src/lib/legalCopy.en.ts'));
  const lib = readFileSync('src/lib/legalPm.ts', 'utf8');
  for (const d of DOCS) for (const l of LOCALES) assert.ok(lib.includes(`../../legal-pm/${d}-${l}.html?raw`), `${d}-${l} import`);
});

test('WLF-07: titles — EN "Terms of Use" (= tick-box label), uz with U+02BB only, no ASCII apostrophe', async () => {
  const { LEGAL_TITLES } = await import('../src/lib/legalPm.titles.ts');
  assert.equal(LEGAL_TITLES.terms.en, 'Terms of Use');
  assert.equal(LEGAL_TITLES.privacy.en, 'Privacy Policy');
  for (const t of [LEGAL_TITLES.terms.uz, LEGAL_TITLES.privacy.uz]) assert.ok(!/['‘’`]/.test(t), t);
  // EN tick-box label text in the PM README links "Terms of Use" and "Privacy Policy".
  const readme = readFileSync(join(PM, 'README.md'), 'utf8');
  assert.ok(readme.includes('accept the Terms of Use and the Privacy Policy'));
  // the PM h1s carry the same names
  assert.match(readFileSync('legal-pm/terms-en.html', 'utf8'), /<h1>[^<]*Terms of Use/);
  assert.match(readFileSync('legal-pm/terms-uz.html', 'utf8'), /<h1>[^<]*foydalanish shartlari/i);
  assert.match(readFileSync('legal-pm/privacy-uz.html', 'utf8'), /<h1>[^<]*maxfiylik siyosati/i);
  const mc = readFileSync('src/lib/marketingCopy.ts', 'utf8');
  assert.ok(!mc.includes('Terms of Service'));
});

test('WLF-07: built bundle serves the PM text for all 6 documents (run after vite build)', () => {
  if (!existsSync('dist/assets')) { assert.fail('dist/ missing: run npm run build before npm test'); }
  const js = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');
  for (const d of DOCS) for (const l of LOCALES) {
    const html = readFileSync(join(PM, `${d}-${l}.html`), 'utf8');
    // Vite inlines ?raw as a JS string literal; check it via JSON-escaped form or the decoded literal.
    const lit = JSON.stringify(html).slice(1, -1);
    const ok = js.includes(lit) || [...js.matchAll(/"((?:[^"\\]|\\.)*<article class=\\?"legal[^"]*?(?:[^"\\]|\\.)*)"/g)].some((m) => { try { return JSON.parse(`"${m[1]}"`) === html; } catch { return false; } }) || js.includes(html);
    assert.ok(ok, `${d}-${l}: PM text not found verbatim in dist bundle`);
  }
  for (const re of OLD) assert.ok(!re.test(js), `dist has legacy text ${re}`);
});
