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

// PM final legal set (final-4: WLF-11, Terms §7 has no Plus numbers, PM 31 Oct 16:15; privacy unchanged since final-3): sha256 prefixes of the exact files /terms and /privacy must serve.
const PINNED: Record<string, string> = {
  'terms-en': '7fbebb1c0c45', 'terms-ru': '218c55be148e', 'terms-uz': '5ef128039511',
  'privacy-en': '6b9ee013ac3c', 'privacy-ru': 'a00adb3fca19', 'privacy-uz': 'cef024962382',
};
test('final-3: served legal text hashes match the pinned PM files; no "(Public Offer)" in any title', async () => {
  const { createHash } = await import('node:crypto');
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  for (const [k, want] of Object.entries(PINNED)) {
    const served = readFileSync(`legal-pm/${k}.html`, 'utf8');
    assert.ok(sha(served).startsWith(want), `${k}: ${sha(served).slice(0, 12)} != ${want}`);
    const h1 = served.match(/<h1>([^<]*)<\/h1>/)![1];
    assert.ok(!/public offer|публичная оферта|ommaviy oferta|\(/i.test(h1), `${k} h1: ${h1}`);
  }
  const { LEGAL_TITLES } = await import('../src/lib/legalPm.titles.ts');
  for (const t of Object.values(LEGAL_TITLES.terms)) assert.ok(!/offer|оферт|oferta|\(/i.test(t as string), t as string);
  // the built bundle carries exactly these strings (hash of the decoded literal)
  if (existsSync('dist/assets')) {
    const js = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');
    for (const k of Object.keys(PINNED)) assert.ok(js.includes(JSON.stringify(readFileSync(`legal-pm/${k}.html`, 'utf8')).slice(1, -1)) || js.includes(readFileSync(`legal-pm/${k}.html`, 'utf8')), `${k} not in dist`);
  }
});

// WLF-11 (final-4): no served legal file may state 200 word lookups per day (Plus has no lookup cap; §7 has no Plus numbers).
const LOOKUP_200 = [
  /200[^.;:()<>]{0,40}(?:word\s*)?look-?ups?/i, /look-?ups?[^.;:()<>]{0,40}\b200\b/i,
  /200[^.;:()<>]{0,40}(?:поиск|запрос|пояснени|слов)/i, /(?:поиск|запрос|пояснени)[^.;:()<>]{0,40}\b200\b/i,
  /200[^.;:()<>]{0,40}(?:qidiruv|soʻz|izoh)/i, /(?:qidiruv|izoh)[^.;:()<>]{0,40}\b200\b/i,
];
const plain = (h: string) => h.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
test('WLF-11: no served legal file says 200 word lookups per day (en/ru/uz)', () => {
  for (const d of DOCS) for (const l of LOCALES) {
    const t = plain(readFileSync(`legal-pm/${d}-${l}.html`, 'utf8'));
    for (const re of LOOKUP_200) assert.ok(!re.test(t), `${d}-${l}: ${t.match(re)?.[0]}`);
  }
  // self-check: the guard catches the final-3 §7 wording in all 3 locales
  for (const bad of ['up to <strong>200 word lookups per day</strong>', 'до <strong>200 пояснений слов в день</strong>', 'kuniga <strong>200 tagacha soʻz izohi</strong>'])
    assert.ok(LOOKUP_200.some((re) => re.test(plain(bad))), bad);
});
