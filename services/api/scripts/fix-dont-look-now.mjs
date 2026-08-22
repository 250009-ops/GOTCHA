/** Re-import Don't Look Now from xpressenglish (full text). */
const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const SOURCE_URL = 'https://xpressenglish.com/our-stories/dont-look-now/';
const title = "Don't Look Now";

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

const login = await api('/auth/login', {
  method: 'POST',
  body: {
    email: process.env.ADMIN_EMAIL ?? 'admin@gotcha.app',
    password: process.env.ADMIN_PASSWORD ?? 'GotchaAdmin2026!',
  },
});
const token = login.accessToken;

const rows = await api('/admin/content/curriculum?type=all', { token });
const existing = rows.find((r) => r.title === title);
if (existing) {
  console.log(`Deleting truncated item ${existing.id} (${existing.wordCount} words)`);
  await api(`/admin/content/${existing.id}`, { method: 'DELETE', token });
}

const preview = await api('/admin/content/ingest-preview', {
  method: 'POST',
  token,
  body: {
    title,
    author: 'Daphne du Maurier',
    contentType: 'story',
    language: 'en',
    sourceUrl: SOURCE_URL,
  },
});
console.log(`Preview: ${preview.chapterCount} chapters, ${preview.wordCount} words`);
console.log('Ending check:', preview.chaptersPayload?.[0]?.pages?.slice(-1)[0]?.text?.slice(-120));

const created = await api('/admin/content', {
  method: 'POST',
  token,
  body: {
    title,
    author: 'Daphne du Maurier',
    description:
      'Grieving parents in Venice encounter a psychic warning — and a city that will not let them leave easily.',
    genre: 'supernatural',
    language: 'en',
    cefrLevel: 'c1',
    contentType: 'story',
    isFree: true,
    priceUsd: 0,
    contentSource: 'public_domain',
    sourceUrl: SOURCE_URL,
    chapters: preview.chaptersPayload,
  },
});
await api(`/admin/content/${created.id}/publish`, { method: 'PATCH', token });
console.log(`✓ Re-published ${created.id} (${preview.wordCount} words, no cover)`);
