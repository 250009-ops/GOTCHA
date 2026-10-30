const pdfs = [
  ['Shum bola direct', "https://n.ziyouz.com/books/uzbek_nasri/G'afur%20G'ulom.%20Shum%20bola%20(qissa).pdf"],
  ['Dunyoning ishlari bimm', 'https://lib.bimm.uz/items/download/10396'],
];

const API = 'https://gotchaa.uz/api/v1';
const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: process.env.ADMIN_PASSWORD }),
}).then((r) => r.json());

for (const [name, sourceUrl] of pdfs) {
  const preview = await fetch(`${API}/admin/content/ingest-preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${login.accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: name, contentType: 'book', language: 'uz', sourceUrl }),
  }).then(async (r) => ({ ok: r.ok, status: r.status, json: r.ok ? r.json() : r.text() }));
  if (!preview.ok) {
    console.log(name, 'FAIL', preview.status, String(preview.json).slice(0, 200));
    continue;
  }
  const j = preview.json;
  const sample = j.chapters?.[0]?.pages?.[0]?.preview ?? '';
  const ok = /[o'ʻg'q]/i.test(sample) && !/%PDF/.test(sample);
  console.log(name, j.wordCount, 'words', ok ? 'OK' : 'BAD');
  console.log(' ', sample.slice(0, 120));
}
