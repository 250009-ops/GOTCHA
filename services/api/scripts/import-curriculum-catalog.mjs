/**
 * Bulk-import the curated English curriculum into the admin Content Library.
 * Uses the same ingest-preview + create + publish flow as the admin UI (no covers).
 *
 * Usage:
 *   node services/api/scripts/import-curriculum-catalog.mjs
 *   API_URL=https://gotchaa.uz/api/v1 ADMIN_EMAIL=... ADMIN_PASSWORD=... node services/api/scripts/import-curriculum-catalog.mjs
 */
const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '<REDACTED-admin-pw>';

const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/** @type {Array<{ title: string; author: string; contentType: 'book' | 'story'; cefrLevel: string; genre: string; sourceUrl?: string; libEbooksUrl?: string; description: string }>} */
const CATALOG = [
  {
    title: 'Flowers for Algernon (Short Version)',
    author: 'Daniel Keyes',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'science fiction',
    sourceUrl: 'https://xpressenglish.com/our-stories/flowers-for-algernon/',
    description:
      'Charlie Gordon undergoes experimental surgery to raise his intelligence — and faces what follows when the effect fades.',
  },
  {
    title: 'Rita Hayworth and Shawshank Redemption',
    author: 'Stephen King',
    contentType: 'story',
    cefrLevel: 'c1',
    genre: 'drama',
    sourceUrl:
      'https://thismortalcoil.weebly.com/uploads/2/6/3/7/26372717/rita_hayworth_and_the_shawshank_redemption.pdf',
    description:
      'Andy Dufresne survives wrongful imprisonment at Shawshank through patience, friendship, and an audacious long game.',
  },
  {
    title: 'The Canterville Ghost',
    author: 'Oscar Wilde',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'comedy',
    sourceUrl: 'https://www.gutenberg.org/ebooks/14522',
    description:
      'An American family moves into a haunted English manor and refuses to be frightened on Wilde’s terms.',
  },
  {
    title: 'The Turn of the Screw',
    author: 'Henry James',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'gothic',
    sourceUrl: 'https://www.gutenberg.org/ebooks/209',
    description:
      'A governess on a lonely estate becomes convinced that sinister figures are corrupting the children in her care.',
  },
  {
    title: 'The Phantom of the Opera',
    author: 'Gaston Leroux',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'mystery',
    sourceUrl: 'https://www.gutenberg.org/ebooks/175',
    description: 'Beneath the Paris Opera House, a masked genius demands devotion — and revenge.',
  },
  {
    title: 'The Hound of the Baskervilles',
    author: 'Arthur Conan Doyle',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'detective',
    sourceUrl: 'https://www.gutenberg.org/ebooks/2852',
    description: 'Holmes and Watson unravel a family curse on the fog-shrouded Devon moors.',
  },
  {
    title: 'Strangers on a Train',
    author: 'Patricia Highsmith',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'thriller',
    sourceUrl: 'https://library.peridot.systems/download/1104/epub/1104.epub',
    description:
      'Two men meet on a train and propose swapping murders — a bargain that will not stay theoretical.',
  },
  {
    title: 'The Lottery',
    author: 'Shirley Jackson',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'horror',
    sourceUrl:
      'https://bpb-us-e2.wpmucdn.com/sites.middlebury.edu/dist/d/2396/files/2019/09/jackson_lottery.pdf',
    description:
      'A sunny village morning and an annual ritual turn into one of the most unsettling endings in American fiction.',
  },
  {
    title: 'The Yellow Wallpaper',
    author: 'Charlotte Perkins Gilman',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'psychological',
    sourceUrl: 'https://www.gutenberg.org/ebooks/1952',
    description:
      'Confined to a room for her “rest cure,” a woman fixates on the wallpaper — and on what moves behind it.',
  },
  {
    title: 'The Tell-Tale Heart',
    author: 'Edgar Allan Poe',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'horror',
    sourceUrl: 'https://en.wikisource.org/wiki/Mystery_Tales_of_Edgar_Allan_Poe/The_Tell-Tale_Heart',
    description:
      'A narrator insists on his sanity while describing the murder he can still hear beneath the floorboards.',
  },
  {
    title: "Don't Look Now",
    author: 'Daphne du Maurier',
    contentType: 'story',
    cefrLevel: 'c1',
    genre: 'supernatural',
    sourceUrl: 'https://xpressenglish.com/our-stories/dont-look-now/',
    description:
      'Grieving parents in Venice encounter a psychic warning — and a city that will not let them leave easily.',
  },
  {
    title: 'What We Talk About When We Talk About Love',
    author: 'Raymond Carver',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'literary fiction',
    sourceUrl:
      'https://lecturia.org/en/short-stories/raymond-carver-what-we-talk-about-when-we-talk-about-love/7952/',
    description:
      'Two couples around a kitchen table try to define love — and discover how little language can hold it.',
  },
];

async function fetchLibEbooksParagraphs(baseUrl) {
  const suffixes = ['', ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `_${c}`)];
  const seen = new Set();
  const paras = [];
  for (const suffix of suffixes) {
    const url = `${baseUrl.replace(/\/$/, '')}${suffix}`;
    const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
    if (!res.ok) break;
    const html = await res.text();
    const pageParas = [...html.matchAll(/&nbsp;&nbsp;&nbsp;&nbsp;([^<]+)/g)]
      .map((m) => m[1].replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim())
      .filter((p) => p.length > 20);
    if (!pageParas.length) break;
    let added = 0;
    for (const p of pageParas) {
      if (seen.has(p)) continue;
      seen.add(p);
      paras.push(p);
      added += 1;
    }
    if (added === 0) break;
  }
  const text = paras.join('\n\n');
  const words = (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
  if (words < 3500) {
    throw new Error(`lib-ebooks extract too short (${words} words)`);
  }
  return text;
}

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
  let plainText;
  if (item.libEbooksUrl) {
    plainText = await fetchLibEbooksParagraphs(item.libEbooksUrl);
    console.log(`   lib-ebooks: ${(plainText.match(/[\p{L}\p{M}']+/gu) ?? []).length} words fetched`);
  }

  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      contentType: item.contentType,
      language: 'en',
      sourceUrl: item.sourceUrl,
      plainText,
    },
  });
  console.log(
    `   preview: ${preview.chapterCount} chapters, ${preview.pageCount} pages, ${preview.wordCount} words`,
  );
  if (preview.wordCount < 200) {
    throw new Error(`Too few words (${preview.wordCount}) — source may be blocked`);
  }

  const created = await api('/admin/content', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      description: item.description,
      genre: item.genre,
      language: 'en',
      cefrLevel: item.cefrLevel,
      contentType: item.contentType,
      isFree: true,
      priceUsd: 0,
      contentSource: 'public_domain',
      sourceUrl: item.sourceUrl ?? item.libEbooksUrl,
      chapters: preview.chaptersPayload,
    },
  });

  await api(`/admin/content/${created.id}/publish`, { method: 'PATCH', token });
  console.log(`   ✓ published id=${created.id} (${preview.wordCount} words, no cover)`);
  return created.id;
}

async function main() {
  console.log(`Importing ${CATALOG.length} titles → ${API}`);
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
