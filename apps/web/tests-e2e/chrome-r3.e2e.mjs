// r3 e2e (needs playwright; not in npm test): WLF-31 mobile login at 390px + shared landing chrome on /, /privacy, /terms, /oferta, 404.
// Usage: PW=/path/to/node_modules/playwright BASE=http://127.0.0.1:4364 SHOTS=/dir node tests-e2e/chrome-r3.e2e.mjs
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || 'playwright');
const BASE = process.env.BASE || 'http://127.0.0.1:4364';
const SHOTS = process.env.SHOTS || '';
const exe = process.env.CHROME || undefined;
let fail = 0; const ok = (c, m) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${m}`); if (!c) fail++; };
const b = await chromium.launch({ executablePath: exe });
// WLF-31: 390x844, burger Log in is clickable (not inert) and goes to /learn/login; header Log in visible.
for (const L of ['en', 'ru', 'uz']) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  await p.route('**/learn/**', (r) => r.fulfill({ status: 200, body: 'learn' }));
  await p.goto(`${BASE}/?lang=${L}`);
  ok(await p.locator('header .bar .right > a.login').isVisible(), `390 ${L}: header Log in visible`);
  await p.click('button.burger');
  const bl = p.locator('#bm a.login');
  ok(!(await bl.evaluate((e) => !!e.closest('[inert]'))), `390 ${L}: burger Log in not inert`);
  await Promise.all([p.waitForURL(/\/learn\/login/, { timeout: 5000 }), bl.click({ timeout: 5000 })]).then(() => ok(true, `390 ${L}: burger Log in navigates to /learn/login`), (e) => ok(false, `390 ${L}: burger Log in click ${e.message.split('\n')[0]}`));
  await p.close();
}
for (const path of ['/', '/privacy', '/terms', '/oferta', '/no-such-page']) for (const L of ['en', 'ru', 'uz']) for (const w of [360, 768, 1280]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(`${BASE}${path}?lang=${L}`);
  await p.waitForSelector('header.nav');
  const r = await p.evaluate(() => ({
    lang: document.documentElement.lang,
    lp: !!document.querySelector('.lp > header.nav') && !!document.querySelector('.lp > footer'),
    oferta: document.querySelector('footer a[href^="/oferta?lang="]')?.getAttribute('href') ?? '',
    legal: [...document.querySelectorAll('footer a[href^="/privacy"], footer a[href^="/terms"]')].map((a) => a.getAttribute('href')),
    logo: document.querySelector('header .logo')?.getAttribute('href'),
    nav: [...document.querySelectorAll('#nav a')].map((a) => a.getAttribute('href')),
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    ozb: document.querySelector('header')?.textContent?.includes("O'zbek") ?? false,
  }));
  const tag = `${path} ${L} ${w}`;
  ok(r.lp, `${tag}: landing header+footer`);
  ok(r.lang === L, `${tag}: html lang ${r.lang}`);
  ok(r.oferta === `/oferta?lang=${L}` && r.legal.every((h) => h.endsWith(`?lang=${L}`)) && r.logo === `/?lang=${L}`, `${tag}: footer/logo links keep ?lang (oferta ${r.oferta})`);
  if (path !== '/') ok(r.nav.every((h) => h.startsWith(`/?lang=${L}#`)), `${tag}: nav anchors -> /?lang=${L}#…`);
  ok(!r.overflow, `${tag}: no horizontal overflow`);
  ok(!r.ozb, `${tag}: no ASCII O'zbek`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/${(path.slice(1) || 'home')}-${L}-${w}.png`, fullPage: path !== '/' });
  await p.close();
}
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
await p.goto(`${BASE}/?lang=uz`);
ok((await p.locator('header').innerText()).includes('Oʻzbekcha') || (await p.locator('header [aria-label="Oʻzbekcha"], header [title="Oʻzbekcha"]').count()) > 0, 'uz 1280: header shows Oʻzbekcha');
await b.close();
console.log(fail ? `FAILED ${fail}` : 'ALL OK');
process.exit(fail ? 1 : 0);
