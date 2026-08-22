/**
 * Probe public-domain Turkish text sources for curriculum titles.
 * Usage (from repo root): node services/api/scripts/_probe-tr-sources.mjs
 * Or from services/api: node scripts/_probe-tr-sources.mjs
 */
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

const ARCHIVE_BASE =
  'https://archive.org/download/sabahattin-ali-cakicinin-ilk-kursunu-tereke';

const ANTHOLOGY_1 = `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20B%C3%BCt%C3%BCn%20%C3%96yk%C3%BCleri%20%231%20-%20De%C4%9Firmen,%20Ka%C4%9Fn%C4%B1,%20Ses_djvu.txt`;
const ANTHOLOGY_2 = `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20B%C3%BCt%C3%BCn%20%C3%96yk%C3%BCleri%20%232%20-%20Yeni%20D%C3%BCnya,%20S%C4%B1r%C3%A7a%20K%C3%B6%C5%9Fk,%20Esirler_djvu.txt`;
const KAMYON_BOOK = `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20Kamyon%20-%20Yap%C4%B1%20Kredi%20Yay%C4%B1nlar%C4%B1%20-%202015_djvu.txt`;

/** @type {Array<{ id: number; title: string; author: string; minWords: number; idealMaxWords?: number; urls: Array<{ url: string; note?: string; extract?: (text: string) => string }> }>} */
const TITLES = [
  {
    id: 1,
    title: 'Kürk Mantolu Madonna (Seçme Bölümler)',
    author: 'Sabahattin Ali',
    minWords: 3000,
    idealMaxWords: 50000,
    urls: [
      { url: 'https://tr.wikisource.org/wiki/K%C3%BCrk_Mantolu_Madonna', note: 'wikisource' },
      {
        url: `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20K%C3%BCrk%20Mantolu%20Madonna%20-%20Yap%C4%B1%20Kredi%20Yay%C4%B1nlar%C4%B1%20-%202015_djvu.txt`,
        note: 'archive djvu',
      },
    ],
  },
  {
    id: 2,
    title: 'Kuyucaklı Yusuf (Özet / Ders Baskısı)',
    author: 'Sabahattin Ali',
    minWords: 800,
    idealMaxWords: 5000,
    urls: [
      {
        url: 'https://web.archive.org/web/20160207133200/http:/cemalaksoy.org/kuyucakli-yusuf-romani-ozeti-konusu-sahis-kadrosu-olay-orgusu-tahlili.html',
        note: 'archive.org summary',
      },
      {
        url: `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20Kuyucakl%C4%B1%20Yusuf%20-%20Yap%C4%B1%20Kredi%20Yay%C4%B1nlar%C4%B1%20-%202015_djvu.txt`,
        note: 'archive full novel',
      },
    ],
  },
  {
    id: 3,
    title: 'Kağnı',
    author: 'Sabahattin Ali',
    minWords: 400,
    idealMaxWords: 2500,
    urls: [
      { url: 'https://blog.ufuk.io/sabahattin-ali-kagni/', note: 'blog full story' },
      {
        url: ANTHOLOGY_1,
        note: 'archive anthology',
        extract: (t) => extractStory(t, ['Bir tarla meselesi'], ['Bizi Beyşehir']),
      },
    ],
  },
  {
    id: 4,
    title: 'Ses',
    author: 'Sabahattin Ali',
    minWords: 400,
    idealMaxWords: 4000,
    urls: [
      { url: 'https://www.izdiham.com/sabahattin-ali-ses/', note: 'izdiham full story' },
      {
        url: ANTHOLOGY_1,
        note: 'archive anthology',
        extract: (t) => extractStory(t, ['Bizi Beyşehir'], ['Köpek']),
      },
    ],
  },
  {
    id: 5,
    title: 'Değirmen',
    author: 'Sabahattin Ali',
    minWords: 400,
    idealMaxWords: 4000,
    urls: [
      {
        url: `${ARCHIVE_BASE}/Sabahattin%20Ali%20-%20De%C4%9Firmen%20-%20Yap%C4%B1%20Kredi%20Yay%C4%B1nlar%C4%B1%20-%202015_djvu.txt`,
        note: 'archive book',
        extract: (t) => extractStory(t, ['Hiç sen bir su değirmeninin'], ['Kurtarılamayan']),
      },
    ],
  },
  {
    id: 6,
    title: 'Sırça Köşk',
    author: 'Sabahattin Ali',
    minWords: 400,
    idealMaxWords: 15000,
    urls: [
      {
        url: ANTHOLOGY_2,
        note: 'archive anthology (title masal)',
        extract: (t) =>
          extractStory(t, ['Bir zamanlar boş gezmeyi'], ['Devlerin Masalı', 'DEVLERİN']),
      },
    ],
  },
  {
    id: 7,
    title: 'Kamyon',
    author: 'Sabahattin Ali',
    minWords: 400,
    idealMaxWords: 5000,
    urls: [
      {
        url: KAMYON_BOOK,
        note: 'archive Kamyon book',
        extract: (t) => extractStory(t, ['Şoför bir eliyle direksiyona'], ['Yaşı daha yirmi sularında']),
      },
    ],
  },
  {
    id: 8,
    title: 'Gramofon Avrat',
    author: 'Sabahattin Ali',
    minWords: 400,
    idealMaxWords: 12000,
    urls: [
      {
        url: KAMYON_BOOK,
        note: 'archive Kamyon book',
        extract: (t) => extractStory(t, ['Yaşı daha yirmi sularında'], ['Tereke', 'TEREKE']),
      },
    ],
  },
  {
    id: 9,
    title: 'Falaka',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [{ url: 'https://tr.wikisource.org/wiki/Falaka', note: 'wikisource' }],
  },
  {
    id: 10,
    title: 'Kaşağı',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [{ url: 'https://tr.wikisource.org/wiki/Ka%C5%9Fa%C4%9F%C4%B1', note: 'wikisource' }],
  },
  {
    id: 11,
    title: 'Bomba',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [{ url: 'https://tr.wikisource.org/wiki/Bomba', note: 'wikisource' }],
  },
  {
    id: 12,
    title: 'Pembe İncili Kaftan',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [{ url: 'https://tr.wikisource.org/wiki/Pembe_%C4%B0ncili_Kaftan', note: 'wikisource' }],
  },
  {
    id: 13,
    title: 'Diyet',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [{ url: 'https://tr.wikisource.org/wiki/Diyet', note: 'wikisource' }],
  },
  {
    id: 14,
    title: 'Ferman',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [{ url: 'https://tr.wikisource.org/wiki/Ferman', note: 'wikisource' }],
  },
  {
    id: 15,
    title: 'Başını Vermeyen Şehit',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [
      { url: 'https://tr.wikisource.org/wiki/Ba%C5%9F%C4%B1n%C4%B1_Vermeyen_%C5%9Eehit', note: 'wikisource' },
    ],
  },
  {
    id: 16,
    title: 'Yalnız Efe',
    author: 'Ömer Seyfettin',
    minWords: 400,
    urls: [{ url: 'https://tr.wikisource.org/wiki/Yaln%C4%B1z_Efe', note: 'wikisource' }],
  },
  {
    id: 17,
    title: 'Son Kuşlar',
    author: 'Sait Faik Abasıyanık',
    minWords: 400,
    idealMaxWords: 3000,
    urls: [{ url: 'https://degarado.com/egitici-hikayeler/hikaye-oku-son-kuslar.html', note: 'degarado' }],
  },
  {
    id: 18,
    title: 'Semaver',
    author: 'Sait Faik Abasıyanık',
    minWords: 400,
    idealMaxWords: 3000,
    urls: [
      {
        url: 'https://degarado.com/egitici-hikayeler/sait-faikten-cok-guzel-bir-hikaye-semaver.html',
        note: 'degarado',
      },
    ],
  },
  {
    id: 19,
    title: 'Sarnıç',
    author: 'Sait Faik Abasıyanık',
    minWords: 400,
    urls: [
      { url: 'https://upas.evvel.org/sarnic.pdf', note: 'upas PDF (scanned; ~178 extractable words)' },
    ],
  },
  {
    id: 20,
    title: 'Şahmerdan',
    author: 'Sait Faik Abasıyanık',
    minWords: 400,
    urls: [],
  },
];

function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

function turkishRatio(text) {
  const sample = text.slice(0, 4000);
  const tr = (sample.match(/[\u00C7\u00E7\u011E\u011F\u0130\u0131\u00D6\u00F6\u015E\u015F\u00DC\u00FC]/g) ?? []).length;
  const latin = (sample.match(/[A-Za-z]/g) ?? []).length;
  return latin ? tr / latin : 0;
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
  if (start < 0) return text;
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
    if (!title || /^Dizin:/i.test(title) || /^Kategori:/i.test(title)) return null;
    return { lang, title, apiOrigin: `https://${lang}.wikisource.org` };
  } catch {
    return null;
  }
}

async function fetchWikiText(url) {
  const parsed = parseWikiSourceUrl(url);
  if (!parsed) return null;
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
  if (!res.ok) return null;
  const payload = await res.json();
  if (payload.error || !payload.parse?.text) return null;
  const html = typeof payload.parse.text === 'string' ? payload.parse.text : '';
  return stripHtml(`<div class="mw-parser-output">${html}</div>`);
}

async function fetchUrl(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8' },
    redirect: 'follow',
  });
  const ct = res.headers.get('content-type') ?? '';
  const body = await res.text();
  return { ok: res.ok, status: res.status, contentType: ct, body, finalUrl: res.url };
}

function scoreCandidate(entry, words) {
  const ideal = entry.idealMaxWords ?? 6000;
  if (words < entry.minWords) return -1;
  if (words <= ideal) return words;
  return Math.max(0, ideal - (words - ideal) * 0.5);
}

async function probeCandidate(entry, candidate) {
  let text = '';
  let status = 0;
  let finalUrl = candidate.url;

  try {
    if (parseWikiSourceUrl(candidate.url)) {
      const wt = await fetchWikiText(candidate.url);
      status = wt ? 200 : 404;
      text = wt ?? '';
    } else {
      const res = await fetchUrl(candidate.url);
      status = res.status;
      finalUrl = res.finalUrl;
      if (!res.ok) return { ...candidate, status, words: 0, ok: false, finalUrl, sample: '' };
      if (/\.txt(\?|$)/i.test(candidate.url) || res.contentType.includes('text/plain')) {
        text = cleanPlain(res.body);
      } else if (/\.pdf(\?|$)/i.test(candidate.url)) {
        text = cleanPlain(res.body.replace(/[^\x20-\x7E\u00C0-\u024F\n\r\t\u0130\u0131\u015E\u015F\u00C7\u00E7\u011E\u011F\u00D6\u00F6\u00DC\u00FC]/g, ' '));
      } else {
        text = stripHtml(res.body);
      }
    }

    if (candidate.extract) text = candidate.extract(text);
    const words = countWords(text);
    const trRatio = turkishRatio(text);
    const sample = text.slice(0, 100).replace(/\s+/g, ' ');
    const ok =
      status >= 200 &&
      status < 400 &&
      words >= entry.minWords &&
      trRatio >= 0.02 &&
      /[\u0130\u0131\u015E\u015F\u00C7\u00E7\u011E\u011F\u00D6\u00F6\u00DC\u00FC]/.test(text.slice(0, 2000));
    return { ...candidate, status, words, ok, finalUrl, sample, trRatio, score: ok ? scoreCandidate(entry, words) : -1 };
  } catch (err) {
    return {
      ...candidate,
      status: 0,
      words: 0,
      ok: false,
      finalUrl: candidate.url,
      sample: err instanceof Error ? err.message : String(err),
      score: -1,
    };
  }
}

async function main() {
  const results = [];

  console.log('Probing Turkish curriculum sources...\n');

  for (const entry of TITLES) {
    let best = null;
    const attempts = [];
    if (!entry.urls.length) {
      console.log(`[${entry.id}] BAD — no candidates ${entry.title}`);
      results.push({
        id: entry.id,
        title: entry.title,
        author: entry.author,
        bestUrl: '—',
        words: 0,
        status: 'BAD',
        note: 'no candidate URLs',
      });
      continue;
    }
    for (const candidate of entry.urls) {
      const r = await probeCandidate(entry, candidate);
      attempts.push(r);
      const tag = r.ok ? 'OK' : 'BAD';
      console.log(
        `[${entry.id}] ${tag} ${r.words}w ${r.status} ${entry.title} ← ${candidate.note ?? candidate.url}`,
      );
      if (r.ok && (!best || r.score > best.score)) best = r;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    results.push({
      id: entry.id,
      title: entry.title,
      author: entry.author,
      bestUrl: best?.finalUrl ?? attempts[0]?.finalUrl ?? '—',
      words: best?.words ?? Math.max(...attempts.map((a) => a.words), 0),
      status: best ? 'OK' : 'BAD',
      note: best?.note ?? attempts.map((a) => `${a.note}:${a.words}w`).join('; '),
    });
  }

  console.log('\n=== MARKDOWN TABLE ===\n');
  console.log('| # | Title | Author | Best URL | Words | Status | Source |');
  console.log('|---|-------|--------|----------|------:|--------|--------|');
  for (const r of results) {
    const url = r.bestUrl.replace(/\|/g, '%7C');
    console.log(`| ${r.id} | ${r.title} | ${r.author} | ${url} | ${r.words} | ${r.status} | ${r.note} |`);
  }

  const okCount = results.filter((r) => r.status === 'OK').length;
  console.log(`\nSummary: ${okCount}/${results.length} OK`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
