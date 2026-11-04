/**
 * Bulk-import the curated German curriculum into the admin Content Library.
 *
 * Usage:
 *   node services/api/scripts/import-german-catalog.mjs
 */
import { PDFParse } from 'pdf-parse';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const ROOT = dirname(fileURLToPath(import.meta.url));
const CACHE = join(ROOT, '.de-text-cache');

function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

function germanStats(text) {
  const de = (text.match(/[a-zA-ZäöüÄÖÜß]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return { de, latin, words: countWords(text) };
}

function assertGerman(text, label) {
  const s = germanStats(text);
  if (s.words < 400) throw new Error(`${label}: too few words (${s.words})`);
  if (s.de <= s.latin * 0.5) {
    throw new Error(`${label}: expected German-heavy text (de=${s.de}, latin=${s.latin})`);
  }
  return s.words;
}

function excerptWords(text, maxWords) {
  const parts = text.split(/\s+/);
  if (parts.length <= maxWords) return text;
  return parts.slice(0, maxWords).join(' ').trim();
}

function halfVolume(text) {
  const words = text.split(/\s+/);
  return words.slice(0, Math.ceil(words.length / 2)).join(' ').trim();
}

function trimFromMarkers(text, markers) {
  const headLimit = Math.max(500, Math.floor(text.length * 0.35));
  let best = -1;
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx >= 60 && idx <= headLimit && idx > best) best = idx;
  }
  return best >= 0 ? text.slice(best).trim() : text;
}

function cleanOcr(text) {
  return text
    .replace(/\r/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function cleanMarioOcr(text) {
  return cleanOcr(text.replace(/\|/g, ' '));
}

function sliceBetween(text, startMarker, endMarkers = []) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Start marker not found: ${startMarker}`);
  let end = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, start + startMarker.length + 80);
    if (idx > start && idx < end) end = idx;
  }
  return text.slice(start, end).trim();
}

function stripWiki(html) {
  const m = html.match(/<div[^>]+class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--|$)/i);
  let body = m?.[1] ?? html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ?? html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<table[\s\S]*?<\/table>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#[0-9]+;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return body;
}

function stripTeach(html) {
  const m = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return (m?.[1] ?? html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMondamo(html) {
  const body = html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ?? html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>/gi, '\n\n# ')
    .replace(/<h2[^>]*>/gi, '\n\n## ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripGutenberg(text) {
  const start = text.search(/\*\*\* START OF (THE|THIS) PROJECT GUTENBERG/i);
  const end = text.search(/\*\*\* END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (start >= 0 && end > start) return text.slice(start, end).trim();
  return text.replace(/^[\s\S]*?(\r?\n\r?\n)/, '').trim();
}

function cleanPdfText(text) {
  return text
    .replace(/\s+--\s+\d+\s+of\s+\d+\s+--/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  return res.text();
}

async function fetchGutenberg(id) {
  const url = `https://www.gutenberg.org/ebooks/${id}.txt.utf-8`;
  const text = stripGutenberg(await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text()));
  const words = assertGerman(text, url);
  return { plainText: text, sourceUrl: url, words };
}

async function fetchWiki(url, { trimMarkers } = {}) {
  let text = stripWiki(await fetchHtml(url));
  if (trimMarkers?.length) text = trimFromMarkers(text, trimMarkers);
  const words = assertGerman(text, url);
  return { plainText: text, sourceUrl: url, words };
}

async function fetchTeachsam(path) {
  const url = `https://www.teachsam.de/deutsch/d_literatur/d_aut/bor/${path}`;
  let text = stripTeach(await fetchHtml(url));
  const words = assertGerman(text, url);
  return { plainText: text, sourceUrl: url, words };
}

async function fetchArchiveDjvu(id) {
  const meta = await fetch(`https://archive.org/metadata/${id}`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.json());
  const file = (meta.files ?? []).find((f) => /djvu\.txt$/i.test(f.name ?? ''));
  if (!file) throw new Error(`No djvu.txt on archive item ${id}`);
  const url = `https://archive.org/download/${id}/${encodeURIComponent(file.name)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  const text = cleanOcr(await res.text());
  if (text.startsWith('<!')) throw new Error(`Archive login wall for ${id}`);
  const words = assertGerman(text, id);
  return { plainText: text, sourceUrl: url, words };
}

async function fetchPdf(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const text = cleanPdfText(((await parser.getText()).text ?? '').replace(/\r/g, '').trim());
  const words = assertGerman(text, url);
  return { plainText: text, sourceUrl: url, words };
}

async function fetchZweigCollection() {
  const url = 'https://www.gutenberg.org/ebooks/57850.txt.utf-8';
  const text = stripGutenberg(await fetch(url, { headers: { 'User-Agent': UA } }).then((r) => r.text()));
  return { plainText: text, sourceUrl: url, words: countWords(text) };
}

async function fetchAventinPrinz() {
  const parts = [];
  for (let i = 1; i <= 27; i += 1) {
    const url = `https://aventin.de/${String(i).padStart(2, '0')}-der-kleine-prinz-novelle/`;
    parts.push(stripWiki(await fetchHtml(url)));
    await new Promise((r) => setTimeout(r, 150));
  }
  const plainText = parts.join('\n\n');
  const words = assertGerman(plainText, 'Der kleine Prinz (aventin)');
  return { plainText, sourceUrl: 'https://aventin.de/01-der-kleine-prinz-novelle/', words };
}

function readCachedPhysiker() {
  const path = join(CACHE, 'physiker-drama.txt');
  let text = readFileSync(path, 'utf8');
  text = text
    .replace(/^#.*$/gm, ' ')
    .replace(/Uploaded by:.*?(?=Patient|Erster Akt)/s, ' ')
    .replace(/Bookmark[\s\S]*?(?=Patient|Erster Akt)/, ' ')
    .trim();
  const start = text.indexOf('Erster Akt');
  if (start > 0) text = text.slice(start);
  return text;
}

/** @type {Array<{ title: string; author: string; contentType: 'book' | 'story'; cefrLevel: string; genre: string; description: string; forceSingleChapter?: boolean; resolve: () => Promise<{ plainText: string; sourceUrl: string; words: number }> }>} */
const CATALOG = [
  {
    title: 'Der Schimmelreiter',
    author: 'Theodor Storm',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Sturmflut-Novelle an der Nordseeküste.',
    resolve: () => fetchWiki('https://de.wikisource.org/wiki/Der_Schimmelreiter', { trimMarkers: ['Der Schimmelreiter'] }),
  },
  {
    title: 'Die Verwandlung',
    author: 'Franz Kafka',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Gregor Samsas verwandelndes Erwachen.',
    resolve: () => fetchGutenberg(22367),
  },
  {
    title: 'Mario und der Zauberer',
    author: 'Thomas Mann',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Tragisches Reiseerlebnis im faschistischen Italien.',
    forceSingleChapter: true,
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('lccn_346017221');
      const start = plainText.indexOf('Torre di Venere');
      if (start < 0) throw new Error('Mario story not found in Mann volume');
      const text = cleanMarioOcr(plainText.slice(start));
      const words = assertGerman(text, 'Mario und der Zauberer');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Der kaukasische Kreidekreis (gekürzte Prosafassung)',
    author: 'Bertolt Brecht',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Prosafassung der Grusche-Handlung für die Lektüre.',
    resolve: async () => {
      const url =
        'https://www.rimini-protokoll.de/website/media/Der%20Kaukasische%20Kreidekreis/54_Kreidekreis_72dpi.pdf';
      const { plainText, sourceUrl } = await fetchPdf(url);
      const text = excerptWords(plainText, 9000);
      const words = assertGerman(text, 'Kreidekreis excerpt');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Kleider machen Leute',
    author: 'Gottfried Keller',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Novelle über Wenzel Strapinski und die Goldstadt.',
    resolve: () => fetchWiki('https://de.wikisource.org/wiki/Kleider_machen_Leute', { trimMarkers: ['Kleider machen Leute'] }),
  },
  {
    title: 'Bahnwärter Thiel',
    author: 'Gerhart Hauptmann',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Naturalistische Erzählung am Bahnübergang.',
    resolve: () => fetchGutenberg(29376),
  },
  {
    title: 'Die Küchenuhr',
    author: 'Wolfgang Borchert',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Nachkriegserzählung über verlorene Zeit.',
    resolve: () => fetchTeachsam('bor_kuech_txt.htm'),
  },
  {
    title: 'Nachts schlafen die Ratten doch',
    author: 'Wolfgang Borchert',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Jürgen bewacht seinen toten Bruder in den Trümmern.',
    resolve: () => fetchTeachsam('bor_nachts_txt.htm'),
  },
  {
    title: 'Mein blasses Mädchen',
    author: 'Wolfgang Borchert',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Kurzgeschichte „Vielleicht hat sie ein rosa Hemd“ (Lernausgabe).',
    resolve: async () => {
      const url = 'https://www.mondamo.de/alt/borchert.htm';
      const html = await fetchHtml(url);
      const text = sliceBetween(stripMondamo(html), 'Vielleicht hat sie ein rosa Hemd', [
        'Draußen vor der Tür',
        '| Draußen',
      ]);
      const words = assertGerman(text, 'Mein blasses Mädchen');
      return { plainText: text, sourceUrl: url, words };
    },
  },
  {
    title: 'Das Brot',
    author: 'Wolfgang Borchert',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Ehepaar und Brotkrümel um halb drei nachts.',
    resolve: () => fetchTeachsam('bor_das_brot_txt.htm'),
  },
  {
    title: 'Die Schachnovelle',
    author: 'Stefan Zweig',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Schachpartie und Gestapo-Erinnerungen auf dem Dampfer.',
    resolve: async () => {
      const url = 'https://curiocurio.de/wp-content/uploads/2025/04/Stefan-Zweig_Schachnovelle_CuriO.pdf';
      const { plainText, sourceUrl, words } = await fetchPdf(url);
      const start = plainText.indexOf('Auf dem großen Passagierdampfer');
      const text = start > 0 ? plainText.slice(start) : plainText;
      return { plainText: text, sourceUrl, words: countWords(text) };
    },
  },
  {
    title: 'Der Amokläufer',
    author: 'Stefan Zweig',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Arzt und Leidenschaft in der Kolonie.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchZweigCollection();
      const text = sliceBetween(plainText, 'Im März des Jahres 1912', ['Die Frau und die Landschaft']);
      const words = assertGerman(text, 'Der Amokläufer');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Brief einer Unbekannten',
    author: 'Stefan Zweig',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Brief der unbekannten Frau an den Schriftsteller.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchZweigCollection();
      const text = sliceBetween(plainText, 'Als der bekannte Romanschriftsteller', ['Die Mondscheingasse']);
      const words = assertGerman(text, 'Brief einer Unbekannten');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Der Sandmann',
    author: 'E.T.A. Hoffmann',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Nathanael, Coppelius und die Automata.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchGutenberg(6341);
      const text = sliceBetween(plainText, 'Nathanael an Lothar', ['Ignaz Denner']);
      const words = assertGerman(text, 'Der Sandmann');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Das Fräulein von Scuderi',
    author: 'E.T.A. Hoffmann',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Kriminalnovelle im Paris Ludwigs XIV.',
    resolve: () => fetchArchiveDjvu('b-1-das-fraulein-von-scuderi'),
  },
  {
    title: 'Aus dem Leben eines Taugenichts (Auszug/Lernausgabe)',
    author: 'Joseph von Eichendorff',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Erster Teil der Romantik-Novelle (Lernausgabe).',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchGutenberg(35312);
      const text = excerptWords(plainText, 12000);
      const words = assertGerman(text, 'Taugenichts excerpt');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'Immensee',
    author: 'Theodor Storm',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Reinhard und Elisabeth am Immensee.',
    resolve: () => fetchGutenberg(6651),
  },
  {
    title: 'Pole Poppenspäler',
    author: 'Theodor Storm',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Novelle über den wandernden Puppenspieler.',
    resolve: () => fetchGutenberg(8919),
  },
  {
    title: 'Der kleine Prinz (Deutsche Übersetzung)',
    author: 'Antoine de Saint-Exupéry',
    contentType: 'book',
    cefrLevel: 'b1',
    genre: 'classic',
    description: 'Deutsche Fassung – Kapitelweise bei Aventin.',
    resolve: () => fetchAventinPrinz(),
  },
  {
    title: 'Die Physiker (Prosafassung/Lernausgabe)',
    author: 'Friedrich Dürrenmatt',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'Gekürzte Lernfassung des Dramas (1. Akt).',
    resolve: async () => {
      const full = readCachedPhysiker();
      const text = excerptWords(full, 9000);
      const words = assertGerman(text, 'Die Physiker excerpt');
      return {
        plainText: text,
        sourceUrl: 'https://idoc.pub/documents/duerrenmatt-friedrich-die-physiker-on23gm72dml0',
        words,
      };
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

async function ensureGermanEnabled(token) {
  try {
    await api('/admin/languages', { method: 'POST', token, body: { code: 'de' } });
    console.log('Enabled language: de');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already|enabled|exists/i.test(msg)) {
      console.log('Language de already enabled');
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

  const ingestBody = item.forceSingleChapter
    ? {
        title: item.title,
        author: item.author,
        contentType: item.contentType,
        language: 'de',
        chapters: [{ title: item.title, text: plainText }],
      }
    : {
        title: item.title,
        author: item.author,
        contentType: item.contentType,
        language: 'de',
        plainText,
      };

  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: ingestBody,
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
      language: 'de',
      cefrLevel: item.cefrLevel,
      contentType: item.contentType,
      isFree: true,
      priceUsd: 0,
      contentSource: 'public_domain',
      sourceUrl,
      chapters: item.forceSingleChapter ? [{ title: item.title, text: plainText }] : preview.chaptersPayload,
    },
  });

  console.log(`   ✓ draft id=${created.id} (${preview.wordCount} words, not published)`);
  return created.id;
}

async function main() {
  console.log(`Importing ${CATALOG.length} German titles → ${API} (draft only)`);
  const token = await login();
  console.log('Logged in as admin.');
  await ensureGermanEnabled(token);

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
