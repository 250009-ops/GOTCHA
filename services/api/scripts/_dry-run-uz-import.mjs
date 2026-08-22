/** Dry-run: verify all Uzbek catalog sources fetch without calling the API. */
import { PDFParse } from 'pdf-parse';

// Minimal copies of helpers from import-uzbek-catalog.mjs
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function stripHtml(html) {
  const body = html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ?? html;
  let text = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  for (const marker of ['—', '–', '-']) {
    const idx = text.indexOf(marker);
    if (idx > 40 && idx < 400) {
      text = text.slice(idx + marker.length).trim();
      break;
    }
  }
  return text;
}

function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

async function fetchLatinPage(url) {
  const latUrl = url.includes('lng=lat') ? url : `${url}${url.includes('?') ? '&' : '?'}lng=lat`;
  const res = await fetch(latUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${latUrl} → ${res.status}`);
  const text = stripHtml(await res.text());
  const words = countWords(text);
  if (words < 400) throw new Error(`${latUrl} only ${words} words`);
  return { words, sourceUrl: latUrl };
}

async function fetchKutubxonaPdf(id, slug) {
  const sourceUrl = `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=${id}:${slug}`;
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`${sourceUrl} → ${res.status}`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const text = ((await parser.getText()).text ?? '').replace(/\r/g, '').trim();
  const words = countWords(text);
  if (words < 400) throw new Error(`${sourceUrl} only ${words} words`);
  return { words, sourceUrl };
}

async function fetchBimm10396() {
  const sourceUrl = 'https://lib.bimm.uz/items/download/10396';
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`bimm → ${res.status}`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const text = ((await parser.getText()).text ?? '').replace(/\r/g, '');
  return { text, sourceUrl, words: countWords(text) };
}

function extractBetween(text, startRe, endRes, { minWords = 500 } = {}) {
  const start = text.search(startRe);
  if (start < 0) return null;
  let end = text.length;
  const tail = text.slice(start + 30);
  for (const er of endRes) {
    const m = tail.search(er);
    if (m >= 0) end = Math.min(end, start + 30 + m);
  }
  const chunk = text.slice(start, end).trim();
  return countWords(chunk) >= minWords ? chunk : null;
}

function excerptWords(text, maxWords = 9000) {
  const parts = text.split(/\s+/);
  if (parts.length <= maxWords) return text;
  return parts.slice(0, maxWords).join(' ').trim();
}

let bimmCache;
async function getBimm() {
  if (!bimmCache) bimmCache = await fetchBimm10396();
  return bimmCache;
}

const CHECKS = [
  ['Dunyoning ishlari', async () => {
    const { text } = await getBimm();
    const c = extractBetween(text, /DUNYONING ISHLARI|Dunyoning ishlari/i, [/URUSHNING|Urushning/i]);
    if (!c) throw new Error('extract failed');
    return countWords(c);
  }],
  ['Shum bola', () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/g-afur-g-ulom-1903-1966/g-afur-g-ulom-shum-bola-qissa')],
  ["Mening o'g'rigina bolam", () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/g-afur-g-ulom-1903-1966/g-afur-g-ulom-mening-o-g-rigina-bolam-hikoya')],
  ['Anor', () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-anor-hikoya')],
  ['Bemor', () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-bemor-hikoya')],
  ['Dahshat', () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-dahshat-hikoya')],
  ["O'g'ri", () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-o-g-ri-hikoya')],
  ['Oltin zanglamas', () => fetchLatinPage('https://ziyouz.uz/ozbek-nasri/shuhrat/shuhrat-oltin-zanglamas-roman/')],
  ['Muzqaymoq', () => fetchLatinPage('https://ziyouz.uz/ozbek-nasri/odil-yoqubov/odil-yoqubov-muzqaymoq-hikoya/')],
  ['Urushning oxirgi qurboni', async () => {
    const { text } = await getBimm();
    const c = extractBetween(text, /URUSHNING OXIRGI|Urushning oxirgi|URUSHNING SO['']NGGI/i, [/MUZPAYMOQ|Muzqaymoq/i, /YANGA/i]);
    if (!c) throw new Error('extract failed');
    return countWords(c);
  }],
  ['Ufq', async () => {
    const { text } = await fetchKutubxonaPdf(6216, 'said-ahmad-ufq-trilogiya');
    let c = extractBetween(text, /QIRIQ BESH KUN|Qirq besh kun/i, [/HIJRON KUNLARI|Hijron kunlari/i], { minWords: 2000 });
    if (!c) c = excerptWords(text.replace(/^[\s\S]{0,8000}/, '').trim(), 10000);
    return countWords(c);
  }],
  ['Saranjam xotin', () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-sarob-hikoya')],
  ["Qorachag'lar", () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-qorako-z-majnun-hikoya')],
  ['Sinchalak', () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-sinchalak-qissa')],
  ['Maftuningman', () => fetchLatinPage('https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-muhabbatning-tug-ilishi-hikoya')],
  ["O'tmishdan ertaklar", async () => {
    const { text } = await fetchKutubxonaPdf(11862, 'sadriddin-ayniy-otmishdan-ertaklar');
    return countWords(excerptWords(text.replace(/^[\s\S]{0,5000}/, '').trim(), 8000));
  }],
  ['Yulduzlar mangu yonadi', () => fetchKutubxonaPdf(718, 'tog-ay-murod-yulduzlar-mangu-yonadi-qissa')],
  ["Otamdan qolgan dalalar", async () => {
    const { text } = await fetchKutubxonaPdf(715, 'tog-ay-murod-otamdan-qolgan-dalalar-roman');
    return countWords(excerptWords(text.replace(/^[\s\S]{0,6000}/, '').trim(), 9000));
  }],
  ['Ot kishnagan oqshom', () => fetchKutubxonaPdf(714, 'tog-ay-murod-ot-kishnagan-oqshom-qissa')],
];

let ok = 0;
const failed = [];
for (const [title, fn] of CHECKS) {
  try {
    const r = await fn();
    const words = typeof r === 'number' ? r : r.words;
    console.log(`OK  ${words}w  ${title}`);
    ok++;
  } catch (e) {
    console.log(`BAD ${title}: ${e.message}`);
    failed.push(title);
  }
}
console.log(`\n${ok}/${CHECKS.length} sources OK`);
if (failed.length) process.exitCode = 1;
