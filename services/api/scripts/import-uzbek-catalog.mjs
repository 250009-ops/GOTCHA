/**
 * Bulk-import the curated Uzbek curriculum into the admin Content Library.
 * Fetches text locally (HTML or PDF) and sends plainText to ingest-preview.
 *
 * Usage:
 *   node services/api/scripts/import-uzbek-catalog.mjs
 */
import { PDFParse } from 'pdf-parse';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
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
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const skip =
    /^(Menyu|ziyouz|Asarning to|Qur'oni|Hadisi|Facebook|Twitter|YouTube|Основное|Lotin|Kirill|Filter|Humo:|Saytimiz|©|E-mail|Feed|Arxiv na|Maqolalar mundarijasi)/i;
  text = text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (skip.test(t)) return false;
      if (/^https?:\/\//i.test(t)) return false;
      return true;
    })
    .join('\n')
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
  if (!res.ok) throw new Error(`Could not download ${latUrl} (${res.status})`);
  const text = stripHtml(await res.text());
  const words = countWords(text);
  if (words < 400) throw new Error(`Too few words from ${latUrl} (${words})`);
  return { text, words, sourceUrl: latUrl };
}

async function fetchKutubxonaPdf(id, slug) {
  const sourceUrl = `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=${id}:${slug}`;
  const res = await fetch(sourceUrl, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`PDF download failed ${sourceUrl} (${res.status})`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const text = ((await parser.getText()).text ?? '').replace(/\r/g, '').trim();
  const words = countWords(text);
  if (words < 400) throw new Error(`PDF too short (${words} words)`);
  return { text, words, sourceUrl };
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

/** @type {Array<{ title: string; author: string; contentType: 'book' | 'story'; cefrLevel: string; genre: string; description: string; resolve: () => Promise<{ plainText: string; sourceUrl: string; words: number }> }>} */
const CATALOG = [
  {
    title: 'Dunyoning ishlari',
    author: "O'tkir Hoshimov",
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Oila va jamiyat hayotidagi murakkab munosabatlar qissasi.',
    resolve: async () => {
      const { text, sourceUrl } = await getBimm();
      const plainText = extractBetween(text, /DUNYONING ISHLARI|Dunyoning ishlari/i, [
        /URUSHNING|Urushning/i,
      ]);
      if (!plainText) throw new Error('Could not extract Dunyoning ishlari from bimm PDF');
      return { plainText, sourceUrl, words: countWords(plainText) };
    },
  },
  {
    title: 'Shum bola',
    author: "G'afur G'ulom",
    contentType: 'book',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Mashhur qissa (qisqartirilgan matn).',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/g-afur-g-ulom-1903-1966/g-afur-g-ulom-shum-bola-qissa',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: "Mening o'g'rigina bolam",
    author: "G'afur G'ulom",
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Ota va o‘g‘il o‘rtasidagi mehr-hurmat hikoyasi.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/g-afur-g-ulom-1903-1966/g-afur-g-ulom-mening-o-g-rigina-bolam-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Anor',
    author: 'Abdulla Qahhor',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Kichik nasr namunasi — anor mavzusidagi hikoya.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-anor-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Bemor',
    author: 'Abdulla Qahhor',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Insoniy mehr va qo‘shnilik haqidagi hikoya.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-bemor-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Dahshat',
    author: 'Abdulla Qahhor',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Urush va inson taqdiri haqidagi hikoya.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-dahshat-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: "O'g'ri",
    author: 'Abdulla Qahhor',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Odamlar taqdiri va ichki kuch haqidagi hikoya.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-o-g-ri-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Oltin zanglamas',
    author: 'Odil Yoqubov',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Qissa (dastur parchasi, ziyouz.uz).',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://ziyouz.uz/ozbek-nasri/shuhrat/shuhrat-oltin-zanglamas-roman/',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Muzqaymoq',
    author: "O'tkir Hoshimov",
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Oilaviy xayrlashuv va bolalik xotiralari hikoyasi.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://ziyouz.uz/ozbek-nasri/odil-yoqubov/odil-yoqubov-muzqaymoq-hikoya/',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Urushning oxirgi qurboni',
    author: "O'tkir Hoshimov",
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Urush va tinchlik mavzusidagi hikoya.',
    resolve: async () => {
      const { text, sourceUrl } = await getBimm();
      const plainText = extractBetween(
        text,
        /URUSHNING SO[\u2018\u2019''ʼ]NGGI QURBONI|Urushning so[\u2018\u2019''ʼ]nggi qurboni/i,
        [/MUZPAYMOQ|Muzqaymoq/i],
      );
      if (!plainText) throw new Error('Could not extract Urushning oxirgi qurboni from bimm PDF');
      return { plainText, sourceUrl, words: countWords(plainText) };
    },
  },
  {
    title: 'Ufq',
    author: 'Said Ahmad',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'classic',
    description: 'Ufq trilogiyasidan parcha (Qirq besh kun boshlanishi).',
    resolve: async () => {
      const { text, sourceUrl } = await fetchKutubxonaPdf(6216, 'said-ahmad-ufq-trilogiya');
      let plainText = extractBetween(
        text,
        /ҚИРҚ БЕШ КУН|QIRIQ BESH KUN|БИРИНЧИ БУЛИМ|Б И Р И Н Ч И Б У Л ИМ/i,
        [/HIJRON KUNLARI|ҲИЖРОН КУНЛАРИ|Hijron kunlari/i],
        { minWords: 2000 },
      );
      if (!plainText) {
        const idx = text.search(/ҚИРҚ БЕШ КУН|QIRIQ BESH KUN/i);
        plainText = idx >= 0 ? excerptWords(text.slice(idx), 10000) : excerptWords(text.slice(8000), 10000);
      } else {
        plainText = excerptWords(plainText, 10000);
      }
      return { plainText, sourceUrl, words: countWords(plainText) };
    },
  },
  {
    title: 'Saranjam xotin',
    author: 'Said Ahmad',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Said Ahmad hikoyasi (Sarob, ziyouz.uz).',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-sarob-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: "Qorachag'lar",
    author: 'Said Ahmad',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Qorako‘z Majnun hikoyasi (ziyouz.uz).',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-qorako-z-majnun-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Sinchalak',
    author: 'Abdulla Qahhor',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Qissa — yoshlik va orzu haqida.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-sinchalak-qissa',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Maftuningman',
    author: 'Said Ahmad',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Muhabbatning tug‘ilishi hikoyasi (ziyouz.uz).',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchLatinPage(
        'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-muhabbatning-tug-ilishi-hikoya',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: "O'tmishdan ertaklar",
    author: 'Sadriddin Ayniy',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Ertaklar to‘plamidan parcha (ziyouz kutubxona).',
    resolve: async () => {
      const { text, sourceUrl } = await fetchKutubxonaPdf(11862, 'sadriddin-ayniy-otmishdan-ertaklar');
      const plainText = excerptWords(text.replace(/^[\s\S]{0,5000}/, '').trim(), 8000);
      return { plainText, sourceUrl, words: countWords(plainText) };
    },
  },
  {
    title: 'Yulduzlar mangu yonadi',
    author: "To'gay Murod",
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'To‘gay Murodning ilk mashhur qissasi.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchKutubxonaPdf(
        718,
        'tog-ay-murod-yulduzlar-mangu-yonadi-qissa',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: "Otamdan qolgan dalalar",
    author: "To'gay Murod",
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'classic',
    description: 'Romanning dastur parchasi (ziyouz kutubxona).',
    resolve: async () => {
      const { text, sourceUrl } = await fetchKutubxonaPdf(715, 'tog-ay-murod-otamdan-qolgan-dalalar-roman');
      const plainText = excerptWords(text.replace(/^[\s\S]{0,6000}/, '').trim(), 9000);
      return { plainText, sourceUrl, words: countWords(plainText) };
    },
  },
  {
    title: 'Ot kishnagan oqshom',
    author: "To'gay Murod",
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Mashhur qissa — milliy ruh va odamlar taqdiri.',
    resolve: async () => {
      const { text, words, sourceUrl } = await fetchKutubxonaPdf(
        714,
        'tog-ay-murod-ot-kishnagan-oqshom-qissa',
      );
      return { plainText: text, sourceUrl, words };
    },
  },
];

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
  if (!out.accessToken) throw new Error('Login succeeded but no accessToken returned');
  return out.accessToken;
}

async function existingTitles(token) {
  const rows = await api('/admin/content/curriculum?type=all', { token });
  return new Set(rows.map((r) => r.title.trim().toLowerCase()));
}

async function importOne(token, item) {
  console.log(`\n── ${item.title}`);
  const { plainText, sourceUrl, words } = await item.resolve();
  console.log(`   fetched locally: ${words} words`);

  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      contentType: item.contentType,
      language: 'uz',
      plainText,
    },
  });
  console.log(
    `   preview: ${preview.chapterCount} chapters, ${preview.pageCount} pages, ${preview.wordCount} words`,
  );
  if (preview.wordCount < 400) {
    throw new Error(`Too few words (${preview.wordCount}) after ingest`);
  }

  const created = await api('/admin/content', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      description: item.description,
      genre: item.genre,
      language: 'uz',
      cefrLevel: item.cefrLevel,
      contentType: item.contentType,
      isFree: true,
      priceUsd: 0,
      contentSource: 'public_domain',
      sourceUrl,
      chapters: preview.chaptersPayload,
    },
  });

  await api(`/admin/content/${created.id}/publish`, { method: 'PATCH', token });
  console.log(`   ✓ published id=${created.id} (${preview.wordCount} words, no cover)`);
  return created.id;
}

async function main() {
  console.log(`Importing ${CATALOG.length} Uzbek titles → ${API}`);
  const token = await login();
  console.log('Logged in as admin.');

  const have = await existingTitles(token);
  let ok = 0;
  let skipped = 0;
  const failed = [];

  for (const item of CATALOG) {
    if (have.has(item.title.trim().toLowerCase())) {
      console.log(`\n── ${item.title}\n   skip (already in library)`);
      skipped += 1;
      continue;
    }
    try {
      await importOne(token, item);
      ok += 1;
    } catch (err) {
      console.error(`   ✗ ${err instanceof Error ? err.message : err}`);
      failed.push({ title: item.title, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log(`\nDone: ${ok} imported, ${skipped} skipped, ${failed.length} failed`);
  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(`  - ${f.title}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
