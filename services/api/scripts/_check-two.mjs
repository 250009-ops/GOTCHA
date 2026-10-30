const API = 'https://gotchaa.uz/api/v1';
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: process.env.ADMIN_PASSWORD }),
}).then((r) => r.json());
const token = login.accessToken;
const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

console.log('Total curriculum items:', rows.length);
console.log('Sample row keys:', Object.keys(rows[0] ?? {}));

for (const title of ['Strangers on a Train', "Don't Look Now"]) {
  const row = rows.find((r) => r.title === title);
  console.log('\n===', title, '===');
  console.log(row);
  const d = await fetch(`${API}/admin/content/${row.id}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  const pages = d.chapters?.flatMap((c) => c.pages ?? []) ?? [];
  const last = pages.at(-1);
  console.log('pages:', pages.length);
  console.log('last preview:', last?.preview?.slice(-150));
}
