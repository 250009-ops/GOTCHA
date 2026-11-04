/**
 * Bulk-import the curated Turkish curriculum into the admin Content Library.
 *
 * Usage:
 *   node services/api/scripts/import-turkish-catalog.mjs
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE = join(ROOT, '.tr-text-cache');

const ARCHIVE_BASE =
  'https://archive.org/download/sabahattin-ali-cakicinin-ilk-kursunu-tereke';
const ANTHOLOGY_1 = `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20B%C3%BCt%C3%BCn%20%C3%96yk%C3%BCleri%20%231%20-%20De%C4%9Firmen,%20Ka%C4%9Fn%C4%B1,%20Ses_djvu.txt`;
const ANTHOLOGY_2 = `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20B%C3%BCt%C3%BCn%20%C3%96yk%C3%BCleri%20%232%20-%20Yeni%20D%C3%BCnya,%20S%C4%B1r%C3%A7a%20K%C3%B6%C5%9Fk,%20Esirler_djvu.txt`;
const KAMYON_BOOK = `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20Kamyon%20-%20Yap%C4%B1%20Kredi%20Yay%C4%B1nlar%C4%B1%20-%202015_djvu.txt`;

function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

function turkishStats(text) {
  const sample = text.slice(0, 4000);
  const tr = (sample.match(/[\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  return { tr, latin, words: countWords(text) };
}

function assertTurkish(text, label, minWords = 400) {
  const s = turkishStats(text);
  if (s.words < minWords) throw new Error(`${label}: too few words (${s.words})`);
  if (s.tr < 10 && s.latin > 200) {
    throw new Error(`${label}: expected Turkish text (tr=${s.tr}, latin=${s.latin})`);
  }
  return s.words;
}

function excerptWords(text, maxWords) {
  const parts = text.split(/\s+/);
  if (parts.length <= maxWords) return text;
  return parts.slice(0, maxWords).join(' ').trim();
}

function cleanPlain(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function stripHtml(html) {
  const body =
    html.match(/<div[^>]+class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--|$)/i)?.[1] ??
    html.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ??
    html;
  return cleanPlain(
    body
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<table[\s\S]*?<\/table>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&#[0-9]+;/g, ' ')
      .replace(/&[a-z]+;/gi, ' '),
  );
}

function extractStory(text, startMarkers, endMarkers) {
  let start = -1;
  for (const m of startMarkers) {
    const idx = text.indexOf(m);
    if (idx >= 0 && (start < 0 || idx < start)) start = idx;
  }
  if (start < 0) throw new Error(`Start marker not found: ${startMarkers.join(' | ')}`);
  let end = text.length;
  const tail = text.slice(start + 40);
  for (const m of endMarkers) {
    const idx = tail.indexOf(m);
    if (idx > 80 && start + 40 + idx < end) end = start + 40 + idx;
  }
  return cleanPlain(text.slice(start, end));
}

function parseWikiSourceUrl(url) {
  try {
    const u = new URL(url);
    if (!/wikisource\.org$/i.test(u.hostname.replace(/^www\./, ''))) return null;
    const lang = u.hostname.split('.')[0];
    const title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, '')).replace(/_/g, ' ');
    return { lang, title, apiOrigin: `https://${lang}.wikisource.org` };
  } catch {
    return null;
  }
}

async function fetchWikiText(url) {
  const parsed = parseWikiSourceUrl(url);
  if (!parsed) throw new Error(`Not a wikisource URL: ${url}`);
  const apiUrl =
    `${parsed.apiOrigin}/w/api.php?` +
    new URLSearchParams({
      action: 'parse',
      page: parsed.title,
      prop: 'text',
      formatversion: '2',
      format: 'json',
      redirects: '1',
      disableeditsection: '1',
      disabletoc: '1',
    });
  const res = await fetch(apiUrl, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Wiki API ${res.status}`);
  const payload = await res.json();
  if (payload.error || !payload.parse?.text) throw new Error(`Wiki parse failed: ${parsed.title}`);
  const html = typeof payload.parse.text === 'string' ? payload.parse.text : '';
  return stripHtml(`<div class="mw-parser-output">${html}</div>`);
}

async function fetchHtml(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  return res.text();
}

async function fetchPlain(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  return cleanPlain(await res.text());
}

function readCache(name) {
  return cleanPlain(readFileSync(join(CACHE, name), 'utf8'));
}

/** @type {Array<{ title: string; author: string; contentType: 'book' | 'story'; cefrLevel: string; genre: string; description: string; forceSingleChapter?: boolean; resolve: () => Promise<{ plainText: string; sourceUrl: string; words: number }> }>} */
const CATALOG = [
  {
    title: 'Kürk Mantolu Madonna (Seçme Bölümler)',
    author: 'Sabahattin Ali',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Seçilmiş bölümler – Raif Efendi’nin günlüğü.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/K%C3%BCrk_Mantolu_Madonna';
      const full = await fetchWikiText(url);
      const text = excerptWords(full, 10000);
      const words = assertTurkish(text, 'Kürk Mantolu Madonna');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Kuyucaklı Yusuf (Özet / Ders Baskısı)',
    author: 'Sabahattin Ali',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Roman özeti – olay örgüsü ve karakterler.',
    forceSingleChapter: true,
    resolve: async () => {
      const url =
        'https://web.archive.org/web/20160207133200/http:/cemalaksoy.org/kuyucakli-yusuf-romani-ozeti-konusu-sahis-kadrosu-olay-orgusu-tahlili.html';
      const text = stripHtml(await fetchHtml(url));
      const words = assertTurkish(text, 'Kuyucaklı Yusuf', 800);
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Kağnı',
    author: 'Sabahattin Ali',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Köyde tarla meselesi ve ağa baskısı.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://blog.ufuk.io/sabahattin-ali-kagni/';
      const text = stripHtml(await fetchHtml(url));
      const words = assertTurkish(text, 'Kağnı');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Ses',
    author: 'Sabahattin Ali',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Beyşehir Gölü kıyısında gece yolculuğu.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://www.izdiham.com/sabahattin-ali-ses/';
      const text = stripHtml(await fetchHtml(url));
      const words = assertTurkish(text, 'Ses');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Değirmen',
    author: 'Sabahattin Ali',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Su değirmeninde geçen kısa öykü.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20De%C4%9Firmen%20-%20Yap%C4%B1%20Kredi%20Yay%C4%B1nlar%C4%B1%20-%202015_djvu.txt`;
      const full = await fetchPlain(url);
      const text = extractStory(full, ['Hiç sen bir su değirmeninin'], ['Kurtarılamayan']);
      const words = assertTurkish(text, 'Değirmen');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Sırça Köşk',
    author: 'Sabahattin Ali',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Masallar çerçevesinde anlatı (seçme bölüm).',
    forceSingleChapter: true,
    resolve: async () => {
      const url = ANTHOLOGY_2;
      const full = await fetchPlain(url);
      const text = extractStory(full, ['Bir zamanlar boş gezmeyi'], ['Devlerin Masalı', 'DEVLERİN']);
      const words = assertTurkish(text, 'Sırça Köşk');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Kamyon',
    author: 'Sabahattin Ali',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Yolculuk ve yolcu tipleri.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = KAMYON_BOOK;
      const full = await fetchPlain(url);
      const text = extractStory(full, ['Şoför bir eliyle direksiyona'], ['Yaşı daha yirmi sularında']);
      const words = assertTurkish(text, 'Kamyon');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Gramofon Avrat',
    author: 'Sabahattin Ali',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Genç bir adamın gramofon ve aşk hikâyesi.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = KAMYON_BOOK;
      const full = await fetchPlain(url);
      const text = extractStory(full, ['Yaşı daha yirmi sularında'], ['Tereke', 'TEREKE']);
      const words = assertTurkish(text, 'Gramofon Avrat');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Falaka',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'İlk okuma metni – falaka ve merhamet.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Falaka';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Falaka');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Kaşağı',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Kış gecesi ve kaşağı.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Ka%C5%9Fa%C4%9F%C4%B1';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Kaşağı', 700);
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Bomba',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Savaş ve çocukluk anısı.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Bomba';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Bomba');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Pembe İncili Kaftan',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Osmanlı dönemi kısa hikâye.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Pembe_%C4%B0ncili_Kaftan';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Pembe İncili Kaftan');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Diyet',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Kan davası ve barış.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Diyet';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Diyet');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Ferman',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Taşralı memur ve ferman.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Ferman';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Ferman');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Başını Vermeyen Şehit',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Kurtuluş Savaşı kahramanlığı.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Ba%C5%9F%C4%B1n%C4%B1_Vermeyen_%C5%9Eehit';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Başını Vermeyen Şehit');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Yalnız Efe',
    author: 'Ömer Seyfettin',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Efe ve yalnızlık.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://tr.wikisource.org/wiki/Yaln%C4%B1z_Efe';
      const text = await fetchWikiText(url);
      const words = assertTurkish(text, 'Yalnız Efe');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Son Kuşlar',
    author: 'Sait Faik Abasıyanık',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Sonbahar ve kuşlar.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://degarado.com/egitici-hikayeler/hikaye-oku-son-kuslar.html';
      const text = stripHtml(await fetchHtml(url));
      const words = assertTurkish(text, 'Son Kuşlar');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Semaver',
    author: 'Sait Faik Abasıyanık',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Adapazarı’nda semaver ve sohbet.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://degarado.com/egitici-hikayeler/sait-faikten-cok-guzel-bir-hikaye-semaver.html';
      const text = stripHtml(await fetchHtml(url));
      const words = assertTurkish(text, 'Semaver');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Sarnıç',
    author: 'Sait Faik Abasıyanık',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Hatıralar sarnıcına akan geçmiş.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://www.insanokur.org/sarnic-sait-faik-abasiyanik/';
      let text;
      try {
        text = stripHtml(await fetchHtml(url));
        const start = text.indexOf('Dağın eteğine');
        if (start > 0) text = text.slice(start);
        const end = text.indexOf('Kitabın Künyesi');
        if (end > start) text = text.slice(0, end);
      } catch {
        text = readCache('sarnic.txt');
      }
      const words = assertTurkish(text, 'Sarnıç');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Şahmerdan',
    author: 'Sait Faik Abasıyanık',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'İskelede şahmerdan makinesi ve ameleler.',
    forceSingleChapter: true,
    resolve: async () => {
      const url = 'https://www.duzcedamla.com/makale/21458325/doc-dr-latif-onur-ugur/sahmerdan';
      let text = readCache('sahmerdan.txt');
      const words = assertTurkish(text, 'Şahmerdan', 400);
      return { plainText: text, sourceUrl: url, words };
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

async function ensureTurkishEnabled(token) {
  try {
    await api('/admin/languages', { method: 'POST', token, body: { code: 'tr' } });
    console.log('Enabled language: tr');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already|enabled|exists/i.test(msg)) {
      console.log('Language tr already enabled');
    } else {
      throw err;
    }
  }
}

async function existingTitles(token) {
  const rows = await api('/admin/content/curriculum?type=all', { token });
  return new Set(rows.map((r) => r.title.trim().toLowerCase()));
}

async function importOne(token, item) {
  console.log(`\n── ${item.title}`);
  const { plainText, sourceUrl, words } = await item.resolve();
  console.log(`   fetched locally: ${words} words`);

  const ingestBody = {
    title: item.title,
    author: item.author,
    contentType: item.contentType,
    language: 'tr',
    chapters: [{ title: item.title, text: plainText }],
  };

  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: ingestBody,
  });
  console.log(
    `   preview: ${preview.chapterCount} chapters, ${preview.pageCount} pages, ${preview.wordCount} words`,
  );
  const minWords = item.title === 'Şahmerdan' || item.title === 'Kaşağı' ? 400 : item.contentType === 'story' ? 700 : 400;
  if (preview.wordCount < minWords) {
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
      language: 'tr',
      cefrLevel: item.cefrLevel,
      contentType: item.contentType,
      isFree: true,
      priceUsd: 0,
      contentSource: 'public_domain',
      sourceUrl,
      chapters: [{ title: item.title, text: plainText }],
    },
  });

  console.log(`   ✓ draft id=${created.id} (${preview.wordCount} words, not published)`);
  return created.id;
}

async function main() {
  console.log(`Importing ${CATALOG.length} Turkish titles → ${API} (draft only)`);
  const token = await login();
  console.log('Logged in as admin.');
  await ensureTurkishEnabled(token);

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
