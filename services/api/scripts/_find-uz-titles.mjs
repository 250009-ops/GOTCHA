/** Find sources for remaining Uzbek catalog titles. */
import { PDFParse } from 'pdf-parse';

const UA = { 'User-Agent': 'Mozilla/5.0 GotchaImporter/2.1' };

function stripHtml(html) {
  const body = html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function words(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

async function fetchLatin(url) {
  const lat = url.includes('?') ? `${url}&lng=lat` : `${url}?lng=lat`;
  for (const u of [lat, url.replace('ziyouz.uz', 'n.ziyouz.com/portal-haqida/xarita/uzbek-nasri').replace(/\/ozbek-nasri\//, '/')]) {
    try {
      const res = await fetch(u, { headers: UA, redirect: 'follow' });
      if (!res.ok) continue;
      const text = stripHtml(await res.text());
      const w = words(text);
      if (w >= 400) return { url: u, words: w, sample: text.slice(0, 100) };
    } catch {}
  }
  return null;
}

async function fetchPdf(id, slug) {
  const url = `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=${id}:${slug}`;
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`PDF ${id} ${res.status}`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const text = ((await parser.getText()).text ?? '').replace(/\s+/g, ' ').trim();
  return { url, words: words(text), text };
}

async function fetchBimm() {
  const url = 'https://lib.bimm.uz/items/download/10396';
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  if (!res.ok) throw new Error(`bimm ${res.status}`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const text = ((await parser.getText()).text ?? '').replace(/\r/g, '');
  return { url, words: words(text), text };
}

function extractBetween(text, startRe, endRes) {
  const start = text.search(startRe);
  if (start < 0) return null;
  let end = text.length;
  for (const er of endRes) {
    const m = text.slice(start + 20).search(er);
    if (m >= 0) end = Math.min(end, start + 20 + m);
  }
  const chunk = text.slice(start, end).trim();
  return words(chunk) >= 500 ? chunk : null;
}

// Said author page links
const saidUrl = 'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/';
const saidRes = await fetch(saidUrl, { headers: UA });
const saidHtml = await saidRes.text();
const saidLinks = [...new Set([...saidHtml.matchAll(/href="(\/portal-haqida\/xarita\/uzbek-nasri\/said-ahmad[^"]+)"/gi)].map((m) => m[1]))];
console.log('Said links:', saidLinks.length);
for (const k of ['saranjam', 'qorachag', 'maftun', 'ufq', 'qorako', 'cho-l']) {
  for (const l of saidLinks.filter((x) => x.toLowerCase().includes(k))) console.log(' ', l);
}

// Web probes
const webUrls = [
  ['O\'g\'ri n.ziyouz', 'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-o-g-ri-hikoya'],
  ['Sinchalak n.ziyouz', 'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-sinchalak-qissa'],
  ['Muzqaymoq', 'https://ziyouz.uz/ozbek-nasri/odil-yoqubov/odil-yoqubov-muzqaymoq-hikoya/?lng=lat'],
  ['Muzqaymoq n', 'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/odil-yoqubov/odil-yoqubov-muzqaymoq-hikoya'],
  ['Oltin zanglamas PDF author', 'https://ziyouz.uz/ozbek-nasri/shuhrat/shuhrat-oltin-zanglamas-roman/?lng=lat'],
];

console.log('\n=== WEB ===');
for (const [name, url] of webUrls) {
  const r = await fetchLatin(url);
  console.log(name, r ? `${r.words}w ${r.url}` : 'FAIL');
}

console.log('\n=== PDFs ===');
const pdfs = [
  [690, 'shuhrat-oltin-zanglamas-roman'],
  [714, 'tog-ay-murod-ot-kishnagan-oqshom-qissa'],
  [715, 'tog-ay-murod-otamdan-qolgan-dalalar-roman'],
  [718, 'tog-ay-murod-yulduzlar-mangu-yonadi-qissa'],
  [6216, 'said-ahmad-ufq-trilogiya'],
  [343, 'sadriddin-ayniy-otmishdan-ertaklar'],
  [11862, 'sadriddin-ayniy-otmishdan-ertaklar'],
  [8257, 'said-ahmad-qorako-z-majnun-hikoyalar'],
  [671, 'said-ahmad-tanlangan-asarlar-1-jild-hikoyalar'],
];

for (const [id, slug] of pdfs) {
  try {
    const r = await fetchPdf(id, slug);
    console.log(`${id}: ${r.words}w`);
    for (const t of ['SARANJAM', 'САРАНЖАМ', 'QORACHAG', 'ҚОРАЧАГ', 'Maftuning', 'MAFTUN', 'Moyliot', 'MOYLIOT', "Mo'yliot", 'DUNYONING', 'URUSHNING']) {
      if (r.text.toUpperCase().includes(t.toUpperCase())) console.log(`  contains ${t}`);
    }
  } catch (e) {
    console.log(`${id}: ERR ${e.message}`);
  }
}

console.log('\n=== BIMM 10396 ===');
try {
  const b = await fetchBimm();
  console.log(`total ${b.words}w`);
  for (const t of ['DUNYONING ISHLARI', 'Dunyoning ishlari', 'URUSHNING', "Urushning so'nggi", 'Muzqaymoq']) {
    const idx = b.text.search(new RegExp(t, 'i'));
    console.log(`  ${t}: ${idx >= 0 ? `@${idx}` : 'NOT'}`);
  }
  const dun = extractBetween(b.text, /DUNYONING ISHLARI|Dunyoning ishlari/i, [/URUSHNING|Urushning/i]);
  const uru = extractBetween(b.text, /URUSHNING|Urushning so['']nggi/i, [/Muzqaymoq|MUZPAYMOQ|YANGA/i]);
  console.log('  extract dunyoning:', dun ? words(dun) + 'w' : 'FAIL');
  console.log('  extract urush:', uru ? words(uru) + 'w' : 'FAIL');
} catch (e) {
  console.log('bimm ERR', e.message);
}
