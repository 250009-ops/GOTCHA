/**
 * Fix mis-tagged Uzbek items stored under language=en on production.
 * Preserves text and cover images — metadata PATCH only.
 */
const API = 'https://gotchaa.uz/api/v1';

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${json.message ?? JSON.stringify(json)}`);
  return json;
}

const token = (await api('/auth/login', {
  method: 'POST',
  body: { email: 'admin@gotcha.app', password: process.env.ADMIN_PASSWORD },
})).accessToken;

// Keep Latin Ufq; remove old Cyrillic duplicate.
await api('/admin/content/07898f92-9520-402b-b5c8-7e113a7eb595', { method: 'DELETE', token });
console.log('Deleted duplicate Cyrillic Ufq');

await api('/admin/content/7b8ae101-d28f-4857-98d6-3ac16c266381', {
  method: 'PATCH',
  token,
  body: { title: 'Ufq', language: 'uz' },
});
console.log('Fixed Ufq → language uz');

await api('/admin/content/529ab3f7-54c5-40a5-9c41-1d5d781b5e57', {
  method: 'PATCH',
  token,
  body: { title: 'Dunyoning ishlari', language: 'uz' },
});
console.log('Fixed Dunyoning ishlari → language uz');

const uz = await api('/admin/content/curriculum?type=all&language=uz', { token });
console.log(`\nUzbek items now: ${uz.length}`);
for (const t of uz.map((i) => i.title).sort()) console.log(' ', t);

const learner = (await api('/auth/login', {
  method: 'POST',
  body: { email: 'learner@gotcha.app', password: process.env.LEARNER_PASSWORD },
})).accessToken;
const feedUz = await api('/content/feed?targetLang=uz', { token: learner });
console.log(`\nLearner feed (uz): ${feedUz.recentlyPublished?.length ?? 0} items`);
