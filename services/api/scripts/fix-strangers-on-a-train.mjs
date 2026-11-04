/** Re-import Strangers on a Train with proper EPUB text extraction. */
import JSZip from 'jszip';
import * as cheerio from 'cheerio';

const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const SOURCE_URL = 'https://library.peridot.systems/download/1104/epub/1104.epub';
const title = 'Strangers on a Train';

function htmlToCleanText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

async function extractEpubText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`EPUB download failed (${res.status})`);
  const zip = await JSZip.loadAsync(Buffer.from(await res.arrayBuffer()));
  const names = Object.keys(zip.files)
    .filter((n) => /index1_split_\d+\.html$/i.test(n) && !zip.files[n].dir)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts = [];
  for (const name of names) {
    const html = await zip.file(name).async('string');
    const text = htmlToCleanText(html);
    if (text) parts.push(text);
  }
  return parts.join('\n\n');
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
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.message ?? json.error}`);
  return json;
}

const plainText = await extractEpubText(SOURCE_URL);
const words = (plainText.match(/[\p{L}\p{M}']+/gu) ?? []).length;
console.log(`Extracted ${words} words`);
console.log('Ending:', plainText.slice(-120));

const login = await api('/auth/login', {
  method: 'POST',
  body: {
    email: process.env.ADMIN_EMAIL ?? 'admin@gotcha.app',
    password: (process.env.ADMIN_PASSWORD ?? (() => { console.error("ADMIN_PASSWORD is required"); process.exit(1); })()),
  },
});
const token = login.accessToken;

const rows = await api('/admin/content/curriculum?type=all', { token });
const existing = rows.find((r) => r.title === title);
if (existing) {
  console.log(`Deleting corrupted item ${existing.id} (${existing.wordCount} words)`);
  await api(`/admin/content/${existing.id}`, { method: 'DELETE', token });
}

const preview = await api('/admin/content/ingest-preview', {
  method: 'POST',
  token,
  body: {
    title,
    author: 'Patricia Highsmith',
    contentType: 'book',
    language: 'en',
    plainText,
  },
});
console.log(`Preview: ${preview.chapterCount} chapters, ${preview.wordCount} words`);

const created = await api('/admin/content', {
  method: 'POST',
  token,
  body: {
    title,
    author: 'Patricia Highsmith',
    description:
      'Two men meet on a train and propose swapping murders — a bargain that will not stay theoretical.',
    genre: 'thriller',
    language: 'en',
    cefrLevel: 'c1',
    contentType: 'book',
    isFree: true,
    priceUsd: 0,
    contentSource: 'public_domain',
    sourceUrl: SOURCE_URL,
    chapters: preview.chaptersPayload,
  },
});
await api(`/admin/content/${created.id}/publish`, { method: 'PATCH', token });
console.log(`✓ Re-published ${created.id} (${preview.wordCount} words, no cover)`);
