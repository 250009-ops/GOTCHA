import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// WLF-07 (final-3): /terms and /privacy must serve the PM's current drafts (team/pm/legal/web), not legacy copy.
const PM = process.env.LEGAL_PM_DIR || '/workspace/gotcha-handoff/team/pm/legal/web';
const DOCS = ['terms', 'privacy'] as const;
const LOCALES = ['en', 'ru', 'uz'] as const;
const OLD = [/non-refundable/i, /parental or guardian permission/i, /United States or any other country/i, /Terms of Service/, /Xizmat ko'rsatish/, /невозвратн/i];

test('WLF-07: vendored legal-pm/privacy-*.html are byte-identical to the PM files; unserved legal-pm/terms-* are retired (r3b)', () => {
  assert.ok(existsSync(PM), `PM legal dir missing: ${PM} (set LEGAL_PM_DIR)`);
  for (const l of LOCALES) assert.ok(!existsSync(`legal-pm/terms-${l}.html`), `legal-pm/terms-${l}.html is a dead copy (/terms serves legal-pm-payments)`);
  for (const l of LOCALES) assert.equal(readFileSync(`legal-pm-payments/terms-${l}.html`, 'utf8'), readFileSync(join(PM, 'pending-payments-02', `terms-${l}.html`), 'utf8'), `legal-pm-payments/terms-${l} drifted; npm run legal:sync-payments`);
  for (const d of ['privacy'] as const) for (const l of LOCALES) {
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
  // payments-02 line: /terms (and /oferta) come from legal-pm-payments/; /privacy stays legal-pm/ (see legal-payments.test.ts).
  for (const d of DOCS) for (const l of LOCALES) assert.ok(lib.includes(`../../${d === 'terms' ? 'legal-pm-payments' : 'legal-pm'}/${d}-${l}.html?raw`), `${d}-${l} import`);
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
  assert.match(readFileSync(join(PM, 'terms-en.html'), 'utf8'), /<h1>[^<]*Terms of Use/);
  assert.match(readFileSync(join(PM, 'terms-uz.html'), 'utf8'), /<h1>[^<]*foydalanish shartlari/i);
  assert.match(readFileSync('legal-pm-payments/terms-en.html', 'utf8'), /<h1>[^<]*Terms of Use/);
  assert.match(readFileSync('legal-pm/privacy-uz.html', 'utf8'), /<h1>[^<]*maxfiylik siyosati/i);
  const mc = readFileSync('src/lib/marketingCopy.ts', 'utf8');
  assert.ok(!mc.includes('Terms of Service'));
});

test('WLF-07: built bundle serves the PM text for all 6 documents (run after vite build)', () => {
  if (!existsSync('dist/assets')) { assert.fail('dist/ missing: run npm run build before npm test'); }
  const js = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');
  for (const d of DOCS) for (const l of LOCALES) {
    const html = readFileSync(d === 'terms' ? join(PM, 'pending-payments-02', `${d}-${l}.html`) : join(PM, `${d}-${l}.html`), 'utf8'); // payments-02 line serves pending terms
    // Vite inlines ?raw as a JS string literal; check it via JSON-escaped form or the decoded literal.
    const lit = JSON.stringify(html).slice(1, -1);
    const ok = js.includes(lit) || [...js.matchAll(/"((?:[^"\\]|\\.)*<article class=\\?"legal[^"]*?(?:[^"\\]|\\.)*)"/g)].some((m) => { try { return JSON.parse(`"${m[1]}"`) === html; } catch { return false; } }) || js.includes(html);
    assert.ok(ok, `${d}-${l}: PM text not found verbatim in dist bundle`);
  }
  for (const re of OLD) assert.ok(!re.test(js), `dist has legacy text ${re}`);
});

// PM legal set (r3b, PM 31 Oct 17:20; Kai decision A, remedy choice in §8): sha256 prefixes. Main terms are the PM's
// team/pm/legal/web/terms-*.html (no vendored copy: legal-pm/terms-* retired); privacy is served from legal-pm/.
// Served /terms on this payments-02 line = legal-pm-payments (pending-payments-02), pinned in PENDING_PINNED.
const PINNED: Record<string, string> = {
  'terms-en': 'a210f70d3f3c', 'terms-ru': '0c5d14a1318e', 'terms-uz': '83bdefb2f0d2',
  'privacy-en': '6b9ee013ac3c', 'privacy-ru': 'a00adb3fca19', 'privacy-uz': 'cef024962382',
};
test('final-3: served legal text hashes match the pinned PM files; no "(Public Offer)" in any title', async () => {
  const { createHash } = await import('node:crypto');
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  for (const [k, want] of Object.entries(PINNED)) {
    const served = readFileSync(k.startsWith('terms-') ? join(PM, `${k}.html`) : `legal-pm/${k}.html`, 'utf8');
    assert.ok(sha(served).startsWith(want), `${k}: ${sha(served).slice(0, 12)} != ${want}`);
    const h1 = served.match(/<h1>([^<]*)<\/h1>/)![1];
    assert.ok(!/public offer|публичная оферта|ommaviy oferta|\(/i.test(h1), `${k} h1: ${h1}`);
  }
  const { LEGAL_TITLES } = await import('../src/lib/legalPm.titles.ts');
  for (const t of Object.values(LEGAL_TITLES.terms)) assert.ok(!/offer|оферт|oferta|\(/i.test(t as string), t as string);
  // the built bundle carries exactly these strings (hash of the decoded literal)
  if (existsSync('dist/assets')) {
    const js = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');
    for (const k of Object.keys(PINNED).filter((x) => !x.startsWith('terms-'))) assert.ok(js.includes(JSON.stringify(readFileSync(`legal-pm/${k}.html`, 'utf8')).slice(1, -1)) || js.includes(readFileSync(`legal-pm/${k}.html`, 'utf8')), `${k} not in dist`);
  }
});

const PENDING_PINNED: Record<string, string> = {
  'terms-en': 'd5d1b69a2ab2', 'terms-ru': '9634a85dd35f', 'terms-uz': '6146bd79835a',
  'oferta-en': '3dfc03dd6872', 'oferta-ru': 'ed44973e592d', 'oferta-uz': '6cf90e1b8bb4',
};
test('r3b: served /terms + /oferta (legal-pm-payments) match the pinned pending-payments-02 files; main §8 == pending §8', async () => {
  const { createHash } = await import('node:crypto');
  const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
  for (const [k, want] of Object.entries(PENDING_PINNED)) {
    const served = readFileSync(`legal-pm-payments/${k}.html`, 'utf8');
    assert.ok(sha(served).startsWith(want), `${k}: ${sha(served).slice(0, 12)} != ${want}`);
  }
  const s8 = (h: string) => h.replace(/<!--[\s\S]*?-->/g, '').split(/<h2>[^<]*8\./)[1]?.split(/<h2>/)[0];
  for (const l of LOCALES) {
    const main = s8(readFileSync(join(PM, `terms-${l}.html`), 'utf8')); const pend = s8(readFileSync(`legal-pm-payments/terms-${l}.html`, 'utf8'));
    assert.ok(main && main === pend, `terms-${l} §8 main != pending`);
  }
  assert.match(readFileSync('legal-pm-payments/terms-en.html', 'utf8'), /you may choose the remedy/);
});
