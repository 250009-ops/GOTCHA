const API = 'https://gotchaa.uz/api/v1';
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: '<REDACTED-admin-pw>' }),
}).then((r) => r.json());
const token = login.accessToken;
for (const lang of ['all', 'en', 'ru']) {
  const qs = lang === 'all' ? 'type=all' : `type=all&language=${lang}`;
  const rows = await fetch(`${API}/admin/content/curriculum?${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  console.log(lang, rows.length, 'items');
}
