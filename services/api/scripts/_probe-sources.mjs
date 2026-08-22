const API = 'https://gotchaa.uz/api/v1';
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: 'GotchaAdmin2026!' }),
}).then((r) => r.json());
const token = login.accessToken;
const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
for (const r of rows.filter((x) => ['The Landlady', 'The Pearl', 'The Most Dangerous Game'].includes(x.title))) {
  const detail = await fetch(`${API}/admin/content/${r.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((x) => x.json());
  console.log(detail.title, '→', detail.sourceUrl ?? '(no url)');
}
