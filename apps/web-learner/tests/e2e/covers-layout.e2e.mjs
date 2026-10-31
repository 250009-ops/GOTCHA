// covers-01: long / Cyrillic / Uzbek (oʻ gʻ) titles stay within the line limits in a real Chrome.
// usage: PW=/path/to/playwright-core node tests/e2e/covers-layout.e2e.mjs [outdir]
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW ?? 'playwright-core');
const out = resolve(process.argv[2] ?? 'node_modules/.cache/covers-e2e');
mkdirSync(out, { recursive: true });
execSync(`npx esbuild tests/e2e/covers-harness.tsx --bundle --format=iife --jsx=automatic --alias:@gotcha/shared=../../packages/shared/src/index.ts --define:process.env.NODE_ENV='"production"' --outfile=${out}/h.js --log-level=warning`, { stdio: 'inherit' });
writeFileSync(`${out}/index.html`, `<!doctype html><meta charset=utf-8><link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT@9..144,600,50&family=Literata:opsz,wght@7..72,600&family=Manrope:wght@600;700&display=swap" rel=stylesheet><body style="margin:0"><div id=root></div><script src=h.js></script>`);
const b = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome' });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto(`file://${out}/index.html`);
await p.waitForSelector('[data-case]');
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(800);
const res = await p.$$eval('[data-case]', (els) => els.map((el) => {
  const [kind, i, w] = el.getAttribute('data-case').split('|');
  const t = el.querySelector(kind === 'hero' ? '.hero-title' : '.gc-title');
  const a = el.querySelector('.gc-author');
  const r = { kind, i: +i, w: +w, text: t?.textContent ?? null };
  if (t) {
    const cs = getComputedStyle(t);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.02;
    r.fontPx = parseFloat(cs.fontSize);
    r.family = cs.fontFamily;
    // rendered (clamped) lines and natural lines
    r.lines = Math.round(t.getBoundingClientRect().height / lh);
    const clone = t.cloneNode(true); clone.style.webkitLineClamp = 'unset'; clone.style.display = 'block'; clone.style.maxHeight = 'none';
    t.parentElement.appendChild(clone); r.natural = Math.round(clone.getBoundingClientRect().height / lh); clone.remove();
    // no mid-word breaks: every word's box fits within the title box width
    const range = document.createRange(); range.selectNodeContents(t);
    r.overflowX = t.scrollWidth > t.clientWidth + 1;
    const box = t.getBoundingClientRect(); const cov = el.getBoundingClientRect();
    const art = el.querySelector('.gc-art'); r.clearOfArt = !art || kind === 'hero' || t.getBoundingClientRect().top >= art.getBoundingClientRect().bottom - 0.5;
    r.insideCover = box.left >= cov.left - 0.5 && box.right <= cov.right + 0.5 && box.bottom <= cov.bottom + 0.5;
  }
  r.author = a ? getComputedStyle(a).display !== 'none' : false;
  return r;
}));
await p.screenshot({ path: `${out}/covers-layout.png`, fullPage: true });
await b.close();
let fails = 0;
for (const r of res) {
  try {
    if (r.kind === 'card') {
      assert.ok(r.fontPx >= 14 && r.fontPx <= 30, `font ${r.fontPx}`);
      assert.ok(r.lines <= 3, `lines ${r.lines}`);
      assert.equal(r.overflowX, false, 'horizontal overflow');
      assert.ok(r.insideCover, 'title escapes the cover');
      assert.ok(r.clearOfArt, 'title overlaps the art panel');
      assert.equal(r.author, r.w >= 150, `author visibility at ${r.w}px`);
      if (/[\u0400-\u04FF\u02BB]/.test(r.text)) assert.match(r.family, /^Literata/);
    } else if (r.kind === 'hero') {
      assert.ok(r.fontPx >= 28 && r.fontPx <= 32, `hero font ${r.fontPx}`);
      assert.ok(r.lines <= 2, `hero lines ${r.lines}`);
    } else assert.equal(r.text, null, 'thumb must have no text');
  } catch (e) { fails++; console.log('FAIL', JSON.stringify(r), e.message); }
}
const clamped = res.filter((r) => r.natural > r.lines).length;
writeFileSync(`${out}/covers-layout.json`, JSON.stringify(res, null, 1));
console.log(`covers layout: ${res.length - fails}/${res.length} cases OK (${clamped} long titles ellipsis-clamped as specified)`);
process.exit(fails ? 1 : 0);
