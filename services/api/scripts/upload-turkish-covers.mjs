/**
 * Upload covers for Turkish curriculum items and publish them.
 * Usage: node services/api/scripts/upload-turkish-covers.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'GotchaAdmin2026!';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(ROOT, '.tr-covers-cache');

const W = 800;
const H = 1200;
const UA = 'GotchaCoverBot/1.0 (+https://gotcha.app)';

/** @type {Array<{ title: string; coverUrl: string }>} */
const COVERS = [
  { title: 'Kürk Mantolu Madonna (Seçme Bölümler)', coverUrl: 'https://covers.openlibrary.org/b/id/10848013-L.jpg' },
  { title: 'Kuyucaklı Yusuf (Özet / Ders Baskısı)', coverUrl: 'https://covers.openlibrary.org/b/id/10848894-L.jpg' },
  { title: 'Kağnı', coverUrl: 'https://covers.openlibrary.org/b/id/12296802-L.jpg' },
  { title: 'Ses', coverUrl: 'https://covers.openlibrary.org/b/id/12296802-L.jpg' },
  { title: 'Değirmen', coverUrl: 'https://covers.openlibrary.org/b/id/12243490-L.jpg' },
  { title: 'Sırça Köşk', coverUrl: 'https://covers.openlibrary.org/b/id/12275204-L.jpg' },
  { title: 'Kamyon', coverUrl: 'https://covers.openlibrary.org/b/id/10852218-L.jpg' },
  { title: 'Gramofon Avrat', coverUrl: 'https://covers.openlibrary.org/b/id/12257058-L.jpg' },
  { title: 'Falaka', coverUrl: 'https://covers.openlibrary.org/b/id/12204188-L.jpg' },
  { title: 'Kaşağı', coverUrl: 'https://covers.openlibrary.org/b/id/12315235-L.jpg' },
  { title: 'Bomba', coverUrl: 'https://covers.openlibrary.org/b/id/10855007-L.jpg' },
  { title: 'Pembe İncili Kaftan', coverUrl: 'https://covers.openlibrary.org/b/id/12314802-L.jpg' },
  { title: 'Diyet', coverUrl: 'https://covers.openlibrary.org/b/id/12314738-L.jpg' },
  { title: 'Ferman', coverUrl: 'https://covers.openlibrary.org/b/id/12308578-L.jpg' },
  { title: 'Başını Vermeyen Şehit', coverUrl: 'https://covers.openlibrary.org/b/id/12282735-L.jpg' },
  { title: 'Yalnız Efe', coverUrl: 'https://covers.openlibrary.org/b/id/10850140-L.jpg' },
  { title: 'Son Kuşlar', coverUrl: 'https://covers.openlibrary.org/b/id/12253344-L.jpg' },
  { title: 'Semaver', coverUrl: 'https://covers.openlibrary.org/b/id/12316236-L.jpg' },
  { title: 'Sarnıç', coverUrl: 'https://covers.openlibrary.org/b/id/12226188-L.jpg' },
  { title: 'Şahmerdan', coverUrl: 'https://covers.openlibrary.org/b/id/10849375-L.jpg' },
];

function slug(title) {
  return title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
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
  await fetchOlCover(entry.coverUrl, out);
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
  console.log(`Turkish covers → ${API}`);
  const token = await login();
  const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const byTitle = new Map(rows.filter((r) => r.language === 'tr').map((r) => [r.title.trim().toLowerCase(), r]));

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
