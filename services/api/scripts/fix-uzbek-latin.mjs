/**
 * Re-ingest Uzbek catalog items with Latin script text.
 * Preserves existing cover images via PATCH /admin/content/:id/reingest.
 *
 * Usage:
 *   node services/api/scripts/fix-uzbek-latin.mjs
 */
import { PDFParse } from 'pdf-parse';
import {
  countWords,
  cyrRatio,
  needsLatinFix,
  stripHtml,
  trimUzbekStoryStart,
  toLatinUz,
} from './lib-uz-latin.mjs';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '<REDACTED-admin-pw>';
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

async function fetchLatinPage(url) {
  const latUrl = url.includes('lng=lat') ? url : `${url}${url.includes('?') ? '&' : '?'}lng=lat`;
  const res = await fetch(latUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${latUrl} (${res.status})`);
  const plainText = trimUzbekStoryStart(stripHtml(await res.text()));
  const words = countWords(plainText);
  if (words < 400) throw new Error(`Too few words from ${latUrl} (${words})`);
  return { plainText, sourceUrl: latUrl, words };
}

async function fetchZiyouzAsLatin(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  const plainText = toLatinUz(stripHtml(await res.text()));
  const words = countWords(plainText);
  if (words < 400) throw new Error(`Too few words from ${url} (${words})`);
  return { plainText, sourceUrl: url, words };
}

async function fetchKutubxonaPdf(id, slug) {
  const sourceUrl = `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=${id}:${slug}`;
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`PDF download failed ${sourceUrl} (${res.status})`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const raw = ((await parser.getText()).text ?? '').replace(/\r/g, '').trim();
  const plainText = toLatinUz(raw);
  const words = countWords(plainText);
  if (words < 400) throw new Error(`PDF too short (${words} words)`);
  return { plainText, sourceUrl, words };
}

async function fetchBimm10396() {
  const sourceUrl = 'https://lib.bimm.uz/items/download/10396';
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`bimm download failed (${res.status})`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const text = ((await parser.getText()).text ?? '').replace(/\r/g, '');
  return { text, sourceUrl };
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

/** title → async () => { plainText, sourceUrl, words, contentType } */
const SOURCES = {
  'Dunyoning ishlari': async () => {
    const { text, sourceUrl } = await getBimm();
    const plainText = extractBetween(text, /DUNYONING ISHLARI|Dunyoning ishlari/i, [
      /URUSHNING|Urushning/i,
    ]);
    if (!plainText) throw new Error('Could not extract Dunyoning ishlari');
    return { plainText: toLatinUz(plainText), sourceUrl, words: countWords(plainText), contentType: 'book' };
  },
  'Shum bola': async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/g-afur-g-ulom-1903-1966/g-afur-g-ulom-shum-bola-qissa',
    );
    return { ...r, contentType: 'book' };
  },
  "Mening o'g'rigina bolam": async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/g-afur-g-ulom-1903-1966/g-afur-g-ulom-mening-o-g-rigina-bolam-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  Anor: async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-anor-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  Bemor: async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-bemor-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  Dahshat: async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-dahshat-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  "O'g'ri": async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-o-g-ri-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  'Oltin zanglamas': async () => {
    const r = await fetchZiyouzAsLatin(
      'https://ziyouz.uz/ozbek-nasri/shuhrat/shuhrat-oltin-zanglamas-roman/',
    );
    return { ...r, contentType: 'book' };
  },
  Muzqaymoq: async () => {
    const r = await fetchZiyouzAsLatin(
      'https://ziyouz.uz/ozbek-nasri/odil-yoqubov/odil-yoqubov-muzqaymoq-hikoya/',
    );
    return { ...r, contentType: 'story' };
  },
  'Urushning oxirgi qurboni': async () => {
    const { text, sourceUrl } = await getBimm();
    const plainText = extractBetween(
      text,
      /URUSHNING SO[\u2018\u2019''ʼ]NGGI QURBONI|Urushning so[\u2018\u2019''ʼ]nggi qurboni/i,
      [/MUZPAYMOQ|Muzqaymoq/i],
    );
    if (!plainText) throw new Error('Could not extract Urushning oxirgi qurboni');
    return { plainText: toLatinUz(plainText), sourceUrl, words: countWords(plainText), contentType: 'story' };
  },
  Ufq: async () => {
    const sourceUrl = `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=6216:said-ahmad-ufq-trilogiya`;
    const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
    const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
    const raw = ((await parser.getText()).text ?? '').replace(/\r/g, '').trim();
    let bestIdx = -1;
    let bestWords = 0;
    for (const m of raw.matchAll(/ҚИРҚ БЕШ КУН|QIRIQ BESH KUN/gi)) {
      const words = countWords(raw.slice(m.index, m.index + 80000));
      if (words > bestWords) {
        bestWords = words;
        bestIdx = m.index;
      }
    }
    if (bestIdx < 0) throw new Error('Ufq section marker not found in PDF');
    const plainText = toLatinUz(excerptWords(raw.slice(bestIdx), 10000));
    if (countWords(plainText) < 2000) throw new Error(`Ufq excerpt too short (${countWords(plainText)} words)`);
    return { plainText, sourceUrl, words: countWords(plainText), contentType: 'book' };
  },
  'Saranjam xotin': async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-sarob-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  "Qorachag'lar": async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-qorako-z-majnun-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  Sinchalak: async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-sinchalak-qissa',
    );
    return { ...r, contentType: 'story' };
  },
  Maftuningman: async () => {
    const r = await fetchLatinPage(
      'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-muhabbatning-tug-ilishi-hikoya',
    );
    return { ...r, contentType: 'story' };
  },
  "O'tmishdan ertaklar": async () => {
    const { plainText: raw, sourceUrl } = await fetchKutubxonaPdf(11862, 'sadriddin-ayniy-otmishdan-ertaklar');
    const plainText = excerptWords(raw.replace(/^[\s\S]{0,5000}/, '').trim(), 8000);
    return { plainText, sourceUrl, words: countWords(plainText), contentType: 'book' };
  },
  'Yulduzlar mangu yonadi': async () => {
    const r = await fetchKutubxonaPdf(718, 'tog-ay-murod-yulduzlar-mangu-yonadi-qissa');
    return { ...r, contentType: 'book' };
  },
  "Otamdan qolgan dalalar": async () => {
    const { plainText: raw, sourceUrl } = await fetchKutubxonaPdf(715, 'tog-ay-murod-otamdan-qolgan-dalalar-roman');
    const plainText = excerptWords(raw.replace(/^[\s\S]{0,6000}/, '').trim(), 9000);
    return { plainText, sourceUrl, words: countWords(plainText), contentType: 'book' };
  },
  'Ot kishnagan oqshom': async () => {
    const r = await fetchKutubxonaPdf(714, 'tog-ay-murod-ot-kishnagan-oqshom-qissa');
    return { ...r, contentType: 'book' };
  },
};

const META = {
  'Dunyoning ishlari': { author: "O'tkir Hoshimov", cefrLevel: 'b2', genre: 'classic' },
  'Shum bola': { author: "G'afur G'ulom", cefrLevel: 'b1', genre: 'classic' },
  "Mening o'g'rigina bolam": { author: "G'afur G'ulom", cefrLevel: 'b1', genre: 'classic' },
  Anor: { author: 'Abdulla Qahhor', cefrLevel: 'b1', genre: 'classic' },
  Bemor: { author: 'Abdulla Qahhor', cefrLevel: 'b1', genre: 'classic' },
  Dahshat: { author: 'Abdulla Qahhor', cefrLevel: 'b2', genre: 'classic' },
  "O'g'ri": { author: 'Abdulla Qahhor', cefrLevel: 'b1', genre: 'classic' },
  'Oltin zanglamas': { author: 'Odil Yoqubov', cefrLevel: 'b2', genre: 'classic' },
  Muzqaymoq: { author: "O'tkir Hoshimov", cefrLevel: 'b1', genre: 'classic' },
  'Urushning oxirgi qurboni': { author: "O'tkir Hoshimov", cefrLevel: 'b2', genre: 'classic' },
  Ufq: { author: 'Said Ahmad', cefrLevel: 'c1', genre: 'classic' },
  'Saranjam xotin': { author: 'Said Ahmad', cefrLevel: 'b2', genre: 'classic' },
  "Qorachag'lar": { author: 'Said Ahmad', cefrLevel: 'b2', genre: 'classic' },
  Sinchalak: { author: 'Abdulla Qahhor', cefrLevel: 'b2', genre: 'classic' },
  Maftuningman: { author: 'Said Ahmad', cefrLevel: 'b1', genre: 'classic' },
  "O'tmishdan ertaklar": { author: 'Sadriddin Ayniy', cefrLevel: 'b2', genre: 'classic' },
  'Yulduzlar mangu yonadi': { author: "To'gay Murod", cefrLevel: 'b2', genre: 'classic' },
  "Otamdan qolgan dalalar": { author: "To'gay Murod", cefrLevel: 'c1', genre: 'classic' },
  'Ot kishnagan oqshom': { author: "To'gay Murod", cefrLevel: 'b2', genre: 'classic' },
};

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    const msg = json.message ?? json.error ?? text.slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

async function login() {
  const out = await api('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  return out.accessToken;
}

async function readerSample(token, id) {
  const page = await api(`/admin/content/${id}/reader/page?from=0`, { token });
  return String(page.plainText ?? '');
}

async function reingest(token, item, plainText, contentType) {
  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: { title: item.title, contentType, language: 'uz', plainText },
  });
  const result = await api(`/admin/content/${item.id}/reingest`, {
    method: 'PATCH',
    token,
    body: {
      title: item.title,
      contentType,
      language: 'uz',
      chapters: preview.chaptersPayload,
    },
  });
  return { preview, result };
}

async function importMissing(token, title, plainText, contentType, sourceUrl) {
  const meta = META[title];
  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: { title, author: meta.author, contentType, language: 'uz', plainText },
  });
  const created = await api('/admin/content', {
    method: 'POST',
    token,
    body: {
      title,
      author: meta.author,
      language: 'uz',
      cefrLevel: meta.cefrLevel,
      contentType,
      genre: meta.genre,
      isFree: true,
      priceUsd: 0,
      contentSource: 'public_domain',
      sourceUrl,
      chapters: preview.chaptersPayload,
    },
  });
  await api(`/admin/content/${created.id}/publish`, { method: 'PATCH', token });
  return created.id;
}

async function main() {
  console.log(`Fix Uzbek Latin script → ${API}`);
  const token = await login();
  const items = await api('/admin/content/curriculum?type=all&language=uz', { token });
  const byTitle = new Map(items.map((i) => [i.title, i]));

  let fixed = 0;
  let skipped = 0;
  let imported = 0;
  const failed = [];

  for (const title of Object.keys(SOURCES)) {
    console.log(`\n── ${title}`);
    try {
      const { plainText, sourceUrl, words, contentType } = await SOURCES[title]();
      if (cyrRatio(plainText) > 0.05) {
        throw new Error(`Source still ${(cyrRatio(plainText) * 100).toFixed(0)}% Cyrillic after conversion`);
      }
      console.log(`   source: ${words} Latin words`);

      const existing = byTitle.get(title);
      if (!existing) {
        const id = await importMissing(token, title, plainText, contentType, sourceUrl);
        console.log(`   ✓ imported id=${id} (no cover — add manually if needed)`);
        imported += 1;
        continue;
      }

      const before = await readerSample(token, existing.id);
      if (!needsLatinFix(before) && cyrRatio(before) <= 0.05 && existing.wordCount >= 200) {
        console.log(`   skip (already Latin, cover kept)`);
        skipped += 1;
        continue;
      }

      const { preview, result } = await reingest(token, existing, plainText, contentType);
      const after = await readerSample(token, existing.id);
      if (cyrRatio(after) > 0.05 || needsLatinFix(after)) {
        throw new Error(`Still not clean Latin after reingest: ${after.slice(0, 80)}`);
      }
      console.log(
        `   ✓ reingested ${preview.wordCount} words (cover=${result.coverImageKey ? 'kept' : 'none'})`,
      );
      console.log(`   after: ${after.slice(0, 90).replace(/\s+/g, ' ')}…`);
      fixed += 1;
    } catch (err) {
      console.error(`   ✗ ${err instanceof Error ? err.message : err}`);
      failed.push({ title, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log(`\nDone: ${fixed} reingested, ${imported} imported, ${skipped} already OK, ${failed.length} failed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
