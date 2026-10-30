/**
 * Upload covers for Korean curriculum items and publish them.
 * Usage: node services/api/scripts/upload-korean-covers.mjs
 */
import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const ROOT = dirname(fileURLToPath(import.meta.url));
const ASSETS =
  process.env.KO_COVER_ASSETS ??
  'C:/Users/Admin/.cursor/projects/c-projects-GOTCHA-android-app/assets';
const OUT_DIR = join(ROOT, '.ko-covers-cache');

/** @type {Array<{ title: string; asset?: string; theme?: { bg: [string, string]; accent: string; lines: string[]; author: string; photo?: string } }>} */
const COVERS = [
  { title: '운수 좋은 날', asset: 'ko-cover-01-unso-joeun-nal.png' },
  { title: '동백꽃', asset: 'ko-cover-02-dongbaekkkot.png' },
  { title: '봄·봄', asset: 'ko-cover-03-bom-bom.png' },
  { title: '메밀꽃 필 무렵', asset: 'ko-cover-04-memilkkot.png' },
  { title: '소나기', asset: 'ko-cover-05-sonagi.png' },
  { title: '날개', asset: 'ko-cover-06-nalgae.png' },
  { title: '수난이대', asset: 'ko-cover-07-sunanidae.png' },
  { title: '화사집/B사감과 러브레터', asset: 'ko-cover-08-b-sagam.png' },
  {
    title: '사랑손님과 어머니',
    theme: {
      bg: ['#7a4a52', '#e8c9b0'],
      accent: '#fff8f0',
      lines: ['사랑손님과', '어머니'],
      author: '주요섭',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/Chuo_Koron_cover_1953.jpg/440px-Chuo_Koron_cover_1953.jpg',
    },
  },
  {
    title: '감자',
    theme: {
      bg: ['#3d2914', '#8b6914'],
      accent: '#f0e6d2',
      lines: ['감자'],
      author: '김동인',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Patates.jpg/440px-Patates.jpg',
    },
  },
  {
    title: '배따라기',
    theme: {
      bg: ['#2f4f4f', '#87a96b'],
      accent: '#f4f1e8',
      lines: ['배따라기'],
      author: '김동인',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Rice_fields_in_Korea.jpg/440px-Rice_fields_in_Korea.jpg',
    },
  },
  {
    title: '광염 소나타',
    theme: {
      bg: ['#4a0f0f', '#d45c2a'],
      accent: '#ffe8d6',
      lines: ['광염', '소나타'],
      author: '김동인',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3e/Fireplace_fire.jpg/440px-Fireplace_fire.jpg',
    },
  },
  {
    title: '발가락이 닮았다',
    theme: {
      bg: ['#1f2a44', '#607d8b'],
      accent: '#eef2f7',
      lines: ['발가락이', '닮았다'],
      author: '김동인',
    },
  },
  {
    title: '레디메이드 인생',
    theme: {
      bg: ['#1a3c40', '#66aabb'],
      accent: '#f0fafc',
      lines: ['레디메이드', '인생'],
      author: '채만식',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Seoul_Cityhall_at_night.jpg/440px-Seoul_Cityhall_at_night.jpg',
    },
  },
  {
    title: '치숙',
    theme: {
      bg: ['#4a3058', '#9b7bb8'],
      accent: '#faf5ff',
      lines: ['치숙'],
      author: '채만식',
    },
  },
  {
    title: '태평천하 (절반 분권판)',
    theme: {
      bg: ['#5c4a1f', '#c9a227'],
      accent: '#fff9e6',
      lines: ['태평천하'],
      author: '채만식',
    },
  },
  {
    title: '탁류 (발췌본)',
    theme: {
      bg: ['#3e3228', '#8a7560'],
      accent: '#f6f0e8',
      lines: ['탁류'],
      author: '채만식 · 발췌본',
    },
  },
  {
    title: '만세전',
    theme: {
      bg: ['#2c3e50', '#95a5a6'],
      accent: '#f5f5f0',
      lines: ['만세전'],
      author: '염상섭',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Yeom_Sang-seop.jpg/440px-Yeom_Sang-seop.jpg',
    },
  },
  {
    title: '표구된 휴지',
    theme: {
      bg: ['#6b5b45', '#d4c4a8'],
      accent: '#fffdf8',
      lines: ['표구된', '휴지'],
      author: '이범선',
    },
  },
  {
    title: '삼포 가는 길',
    theme: {
      bg: ['#2b4c7e', '#d8e8f8'],
      accent: '#ffffff',
      lines: ['삼포', '가는 길'],
      author: '황석영',
      photo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Snowy_road_in_winter.jpg/440px-Snowy_road_in_winter.jpg',
    },
  },
];

const W = 800;
const H = 1200;
const UA = 'GotchaCoverBot/1.0 (+https://gotcha.app)';

function slug(title) {
  return title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40);
}

function svgCover({ bg, accent, lines, author }) {
  const titleSize = lines.some((l) => l.length > 8) ? 56 : lines.length > 1 ? 64 : 72;
  const lineYs = lines.map((_, i) => 520 + i * (titleSize + 18));
  const titleSvg = lines
    .map(
      (line, i) =>
        `<text x="400" y="${lineYs[i]}" text-anchor="middle" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="${titleSize}" font-weight="700" fill="${accent}">${escapeXml(line)}</text>`,
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
  <text x="400" y="${lineYs[lineYs.length - 1] + 90}" text-anchor="middle" font-family="'Malgun Gothic','Apple SD Gothic Neo',sans-serif" font-size="34" fill="${accent}" fill-opacity="0.92" filter="url(#shadow)">${escapeXml(author)}</text>
  <text x="400" y="1120" text-anchor="middle" font-family="Georgia,serif" font-size="22" letter-spacing="6" fill="${accent}" fill-opacity="0.55">GOTCHA · 한국 문학</text>
</svg>`);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
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
      .modulate({ brightness: 0.75, saturation: 0.85 })
      .blur(1.2)
      .png()
      .toBuffer();
    layers.push(bg);
    const veil = await sharp({
      create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.45 } },
    })
      .png()
      .toBuffer();
    layers.push(veil);
  } else {
    const grad = await sharp(svgCover(theme)).png().toBuffer();
    layers.push(grad);
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

  if (entry.asset) {
    const src = join(ASSETS, entry.asset);
    if (!existsSync(src)) throw new Error(`Missing asset: ${src}`);
    await sharp(src).resize(W, H, { fit: 'cover', position: 'centre' }).jpeg({ quality: 90 }).toFile(out);
    return out;
  }
  if (entry.theme) {
    await buildThemedCover(entry.theme, out);
    return out;
  }
  throw new Error(`No cover source for ${entry.title}`);
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
  console.log(`Korean covers → ${API}`);
  const token = await login();
  const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const byTitle = new Map(rows.filter((r) => r.language === 'ko').map((r) => [r.title.trim().toLowerCase(), r]));

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
