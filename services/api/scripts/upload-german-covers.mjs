/**
 * Upload covers for German curriculum items and publish them.
 * Usage: node services/api/scripts/upload-german-covers.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(ROOT, '.de-covers-cache');

const W = 800;
const H = 1200;
const UA = 'GotchaCoverBot/1.0 (+https://gotcha.app)';

/** @type {Array<{ title: string; coverUrl?: string; theme?: { bg: [string, string]; accent: string; lines: string[]; author: string; photo?: string } }>} */
const COVERS = [
  {
    title: 'Der Schimmelreiter',
    coverUrl: 'https://covers.openlibrary.org/b/id/1010613-L.jpg',
  },
  {
    title: 'Die Verwandlung',
    coverUrl: 'https://covers.openlibrary.org/b/id/12820198-L.jpg',
  },
  {
    title: 'Mario und der Zauberer',
    coverUrl: 'https://covers.openlibrary.org/b/id/1022923-L.jpg',
  },
  {
    title: 'Der kaukasische Kreidekreis (gekürzte Prosafassung)',
    coverUrl: 'https://covers.openlibrary.org/b/id/787542-L.jpg',
  },
  {
    title: 'Kleider machen Leute',
    coverUrl: 'https://covers.openlibrary.org/b/id/5749460-L.jpg',
  },
  {
    title: 'Bahnwärter Thiel',
    coverUrl: 'https://covers.openlibrary.org/b/id/10395718-L.jpg',
  },
  {
    title: 'Die Küchenuhr',
    theme: {
      bg: ['#2a2a32', '#6b6b78'],
      accent: '#f0f0f5',
      lines: ['Die', 'Küchenuhr'],
      author: 'Wolfgang Borchert',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Kitchen_clock.jpg/440px-Kitchen_clock.jpg',
    },
  },
  {
    title: 'Nachts schlafen die Ratten doch',
    theme: {
      bg: ['#1a1a22', '#4a4a58'],
      accent: '#e8e8f0',
      lines: ['Nachts schlafen', 'die Ratten doch'],
      author: 'Wolfgang Borchert',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Hamburg_ruins_1946.jpg/440px-Hamburg_ruins_1946.jpg',
    },
  },
  {
    title: 'Mein blasses Mädchen',
    theme: {
      bg: ['#3d2a3a', '#8a6078'],
      accent: '#faf0f5',
      lines: ['Mein blasses', 'Mädchen'],
      author: 'Wolfgang Borchert',
    },
  },
  {
    title: 'Das Brot',
    coverUrl: 'https://covers.openlibrary.org/b/id/1013643-L.jpg',
  },
  {
    title: 'Die Schachnovelle',
    theme: {
      bg: ['#1a2438', '#3d5a80'],
      accent: '#eef4fc',
      lines: ['Die', 'Schachnovelle'],
      author: 'Stefan Zweig',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/Chess_set.jpg/440px-Chess_set.jpg',
    },
  },
  {
    title: 'Der Amokläufer',
    coverUrl: 'https://covers.openlibrary.org/b/id/7170270-L.jpg',
  },
  {
    title: 'Brief einer Unbekannten',
    coverUrl: 'https://covers.openlibrary.org/b/id/1022090-L.jpg',
  },
  {
    title: 'Der Sandmann',
    theme: {
      bg: ['#2a1a28', '#5a3a50'],
      accent: '#f5e8f0',
      lines: ['Der', 'Sandmann'],
      author: 'E.T.A. Hoffmann',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Nuremberg_sandman.jpg/440px-Nuremberg_sandman.jpg',
    },
  },
  {
    title: 'Das Fräulein von Scuderi',
    coverUrl: 'https://covers.openlibrary.org/b/id/11477207-L.jpg',
  },
  {
    title: 'Aus dem Leben eines Taugenichts (Auszug/Lernausgabe)',
    coverUrl: 'https://covers.openlibrary.org/b/id/8244662-L.jpg',
  },
  {
    title: 'Immensee',
    coverUrl: 'https://covers.openlibrary.org/b/id/6265973-L.jpg',
  },
  {
    title: 'Pole Poppenspäler',
    coverUrl: 'https://covers.openlibrary.org/b/id/5866131-L.jpg',
  },
  {
    title: 'Der kleine Prinz (Deutsche Übersetzung)',
    coverUrl: 'https://covers.openlibrary.org/b/id/10708272-L.jpg',
  },
  {
    title: 'Die Physiker (Prosafassung/Lernausgabe)',
    coverUrl: 'https://covers.openlibrary.org/b/id/569578-L.jpg',
  },
];

function slug(title) {
  return title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function svgCover({ bg, accent, lines, author }) {
  const titleSize = lines.some((l) => l.length > 14) ? 44 : lines.length > 1 ? 56 : 68;
  const lineYs = lines.map((_, i) => 520 + i * (titleSize + 20));
  const titleSvg = lines
    .map(
      (line, i) =>
        `<text x="400" y="${lineYs[i]}" text-anchor="middle" font-family="'Segoe UI',Tahoma,'Arial Unicode MS',sans-serif" font-size="${titleSize}" font-weight="700" fill="${accent}">${escapeXml(line)}</text>`,
    )
    .join('\n');
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stop-color="${bg[0]}"/>
      <stop offset="100%" stop-color="${bg[1]}"/>
    </linearGradient>
    <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-opacity="0.35"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" fill="none" stroke="${accent}" stroke-opacity="0.25" stroke-width="2"/>
  ${titleSvg}
  <text x="400" y="${lineYs[lineYs.length - 1] + 90}" text-anchor="middle" font-family="'Segoe UI',Tahoma,'Arial Unicode MS',sans-serif" font-size="32" fill="${accent}" fill-opacity="0.92" filter="url(#shadow)">${escapeXml(author)}</text>
  <text x="400" y="1120" text-anchor="middle" font-family="Georgia,serif" font-size="22" letter-spacing="4" fill="${accent}" fill-opacity="0.55">GOTCHA · Deutsche Literatur</text>
</svg>`);
}

async function fetchPhoto(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 2000) return null;
    return buf;
  } catch {
    return null;
  }
}

async function buildThemedCover(theme, outPath) {
  const photoBuf = theme.photo ? await fetchPhoto(theme.photo) : null;
  const layers = [];

  if (photoBuf) {
    const bg = await sharp(photoBuf)
      .resize(W, H, { fit: 'cover', position: 'centre' })
      .modulate({ brightness: 0.72, saturation: 0.88 })
      .blur(1.2)
      .png()
      .toBuffer();
    layers.push(bg);
    const veil = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.48 } },
    })
      .png()
      .toBuffer();
    layers.push(veil);
  } else {
    layers.push(await sharp(svgCover(theme)).png().toBuffer());
  }

  const textLayer = await sharp(svgCover({ ...theme, bg: ['#00000000', '#00000000'] }))
    .png()
    .toBuffer();

  await sharp(layers[0])
    .composite([...(layers[1] ? [{ input: layers[1], blend: 'over' }] : []), { input: textLayer, blend: 'over' }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);
}

async function fetchOlCover(url, outPath) {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download cover (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 3000) throw new Error(`Cover too small (${buf.length}b)`);
  await sharp(buf)
    .resize(W, H, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(outPath);
}

async function resolveCoverPath(entry) {
  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${slug(entry.title)}.jpg`);
  if (entry.coverUrl) {
    await fetchOlCover(entry.coverUrl, out);
  } else if (entry.theme) {
    await buildThemedCover(entry.theme, out);
  } else {
    throw new Error('No coverUrl or theme');
  }
  return out;
}

async function login() {
  const out = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  }).then(async (r) => {
    const j = await r.json();
    if (!r.ok) throw new Error(j.message ?? 'login failed');
    return j;
  });
  return out.accessToken;
}

async function uploadCover(token, id, filePath) {
  const buf = readFileSync(filePath);
  const form = new FormData();
  form.append('file', new Blob([buf], { type: 'image/jpeg' }), `${id}.jpg`);
  const res = await fetch(`${API}/admin/content/${id}/cover`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `upload ${res.status}`);
  return json;
}

async function publish(token, id) {
  const res = await fetch(`${API}/admin/content/${id}/publish`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.message ?? `publish ${res.status}`);
  return json;
}

async function main() {
  console.log(`German covers → ${API}`);
  const token = await login();
  const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const byTitle = new Map(rows.filter((r) => r.language === 'de').map((r) => [r.title.trim().toLowerCase(), r]));

  let ok = 0;
  const failed = [];

  for (const entry of COVERS) {
    console.log(`\n── ${entry.title}`);
    const row = byTitle.get(entry.title.toLowerCase());
    if (!row) {
      console.error('   ✗ not found in catalog');
      failed.push({ title: entry.title, error: 'not found' });
      continue;
    }
    try {
      const coverPath = await resolveCoverPath(entry);
      const uploaded = await uploadCover(token, row.id, coverPath);
      console.log(`   ✓ cover ${uploaded.coverImageKey}`);
      if (row.publishStatus !== 'published') {
        await publish(token, row.id);
        console.log('   ✓ published');
      } else {
        console.log('   · already published');
      }
      ok += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`   ✗ ${msg}`);
      failed.push({ title: entry.title, error: msg });
    }
  }

  console.log(`\nDone: ${ok}/${COVERS.length} covers uploaded & published`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.title}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
