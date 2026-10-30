/**
 * Upload covers for Arabic curriculum items and publish them.
 * Usage: node services/api/scripts/upload-arabic-covers.mjs
 */
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(ROOT, '.ar-covers-cache');

/** @type {Array<{ title: string; theme: { bg: [string, string]; accent: string; lines: string[]; author: string; photo?: string } }>} */
const COVERS = [
  {
    title: 'قنديل أم هاشم',
    theme: {
      bg: ['#1a2744', '#c9a84c'],
      accent: '#fff8e7',
      lines: ['قنديل', 'أم هاشم'],
      author: 'يحيى حقي',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4f/Khan_el-Khalili_%28cropped%29.jpg/440px-Khan_el-Khalili_%28cropped%29.jpg',
    },
  },
  {
    title: 'موسم الهجرة إلى الشمال (فصول مختارة)',
    theme: {
      bg: ['#2d4a3e', '#87a878'],
      accent: '#f0f5ec',
      lines: ['موسم الهجرة', 'إلى الشمال'],
      author: 'الطيب صالح · فصول مختارة',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Nile_River_and_delta_from_orbit.jpg/440px-Nile_River_and_delta_from_orbit.jpg',
    },
  },
  {
    title: 'دومة ود حامد',
    theme: {
      bg: ['#4a3520', '#a08060'],
      accent: '#faf6f0',
      lines: ['دومة', 'ود حامد'],
      author: 'الطيب صالح',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/53/Village_in_Sudan.jpg/440px-Village_in_Sudan.jpg',
    },
  },
  {
    title: 'عصفور من الشرق (طبعة مبسطة)',
    theme: {
      bg: ['#3d2b52', '#7b68a6'],
      accent: '#f5f0ff',
      lines: ['عصفور', 'من الشرق'],
      author: 'توفيق الحكيم · طبعة مبسطة',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Cairo_skyline.jpg/440px-Cairo_skyline.jpg',
    },
  },
  {
    title: 'أرني الله',
    theme: {
      bg: ['#1f3d4d', '#5a8a9a'],
      accent: '#eef8fc',
      lines: ['أرني الله'],
      author: 'توفيق الحكيم',
    },
  },
  {
    title: 'أرخص ليالي',
    theme: {
      bg: ['#2a1f1f', '#6b4545'],
      accent: '#f5ecec',
      lines: ['أرخص', 'ليالي'],
      author: 'يوسف إدريس',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/Cairo_at_night.jpg/440px-Cairo_at_night.jpg',
    },
  },
  {
    title: 'النداهة',
    theme: {
      bg: ['#1a1a2e', '#4a4a6a'],
      accent: '#e8e8f5',
      lines: ['النداهة'],
      author: 'يوسف إدريس',
    },
  },
  {
    title: 'بيت من لحم',
    theme: {
      bg: ['#4a3030', '#8b6060'],
      accent: '#fff5f5',
      lines: ['بيت', 'من لحم'],
      author: 'يوسف إدريس',
    },
  },
  {
    title: 'نظرة',
    theme: {
      bg: ['#3a3a50', '#8888aa'],
      accent: '#f4f4fa',
      lines: ['نظرة'],
      author: 'يوسف إدريس',
    },
  },
  {
    title: 'قاع المدينة',
    theme: {
      bg: ['#2c2c2c', '#666666'],
      accent: '#f0f0f0',
      lines: ['قاع', 'المدينة'],
      author: 'ي\u0648\u0633\u0641 \u0625\u062f\u0631\u064a\u0633',
    },
  },
  {
    title: 'زعبلاوي',
    theme: {
      bg: ['#3d2914', '#8b6914'],
      accent: '#fff9e6',
      lines: ['زعبلاوي'],
      author: 'نجيب محفوظ',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5e/Islamic_Cairo.jpg/440px-Islamic_Cairo.jpg',
    },
  },
  {
    title: 'دنيا الله',
    theme: {
      bg: ['#1e3a5f', '#4a7ab0'],
      accent: '#eef4fc',
      lines: ['دنيا الله'],
      author: 'نجيب محفوظ',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7a/Naguib_Mahfouz.jpg/440px-Naguib_Mahfouz.jpg',
    },
  },
  {
    title: 'همس الجنون',
    theme: {
      bg: ['#2d1f3d', '#6b5094'],
      accent: '#f5f0fa',
      lines: ['همس', 'الجنون'],
      author: 'نجيب محفوظ',
    },
  },
  {
    title: 'حكاية بلا بداية ولا نهاية',
    theme: {
      bg: ['#3a2830', '#8a6070'],
      accent: '#faf0f3',
      lines: ['حكاية بلا', 'بداية ولا نهاية'],
      author: 'نجيب محفوظ',
    },
  },
  {
    title: 'الشريدة',
    theme: {
      bg: ['#4a3540', '#9a7080'],
      accent: '#fdf5f8',
      lines: ['الشريدة'],
      author: 'نجيب محفوظ',
    },
  },
  {
    title: 'رجال في الشمس',
    theme: {
      bg: ['#8b4513', '#daa520'],
      accent: '#fff8e0',
      lines: ['رجال', 'في الشمس'],
      author: 'غسان كنفاني',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/43/Desert_road_UAE.jpg/440px-Desert_road_UAE.jpg',
    },
  },
  {
    title: 'عائد إلى حيفا',
    theme: {
      bg: ['#3d4a2a', '#7a9060'],
      accent: '#f4f8ee',
      lines: ['عائد', 'إلى حيفا'],
      author: 'غسان كنفاني',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2f/Haifa_from_air.jpg/440px-Haifa_from_air.jpg',
    },
  },
  {
    title: 'أم سعد',
    theme: {
      bg: ['#4a3020', '#a07050'],
      accent: '#faf3ee',
      lines: ['أم سعد'],
      author: 'غسان كنفاني',
    },
  },
  {
    title: 'موت سرير رقم 12',
    theme: {
      bg: ['#2a3040', '#607090'],
      accent: '#eef2f8',
      lines: ['موت سرير', 'رقم 12'],
      author: 'غسان كنفاني',
    },
  },
  {
    title: 'أرض البرتقال الحزين',
    theme: {
      bg: ['#8b5a2b', '#e8943a'],
      accent: '#fff8f0',
      lines: ['أرض البرتقال', 'الحزين'],
      author: 'غسان كنفاني',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Orange_grove.jpg/440px-Orange_grove.jpg',
    },
  },
];

const W = 800;
const H = 1200;
const UA = 'GotchaCoverBot/1.0 (+https://gotcha.app)';

function slug(title) {
  return title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
}

function svgCover({ bg, accent, lines, author }) {
  const titleSize = lines.some((l) => l.length > 12) ? 48 : lines.length > 1 ? 58 : 68;
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
  <text x="400" y="1120" text-anchor="middle" font-family="Georgia,serif" font-size="22" letter-spacing="4" fill="${accent}" fill-opacity="0.55">GOTCHA · أدب عربي</text>
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

async function resolveCoverPath(entry) {
  mkdirSync(OUT_DIR, { recursive: true });
  const out = join(OUT_DIR, `${slug(entry.title)}.jpg`);
  await buildThemedCover(entry.theme, out);
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
  console.log(`Arabic covers → ${API}`);
  const token = await login();
  const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const byTitle = new Map(rows.filter((r) => r.language === 'ar').map((r) => [r.title.trim().toLowerCase(), r]));

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
