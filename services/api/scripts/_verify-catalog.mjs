const API = 'https://gotchaa.uz/api/v1';
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: '<REDACTED-admin-pw>' }),
}).then((r) => r.json());
const token = login.accessToken;
const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const targets = [
  "Don't Look Now",
  'What We Talk About When We Talk About Love',
  'Flowers for Algernon (Short Version)',
];
for (const title of targets) {
  const row = rows.find((r) => r.title === title);
  if (!row) {
    console.log(title, 'MISSING');
    continue;
  }
  const detail = await fetch(`${API}/admin/content/${row.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const lastPage = detail.chapters?.[0]?.pages?.slice(-1)[0];
  console.log(title, 'words=', row.wordCount, 'cover=', row.coverImageKey ?? 'none', 'preview_end=', lastPage?.preview?.slice(-120));
}
