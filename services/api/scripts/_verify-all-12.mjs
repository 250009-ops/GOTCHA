/** Verify all 12 curriculum titles on production. */
const API = 'https://gotchaa.uz/api/v1';
const EXPECTED = [
  'Flowers for Algernon (Short Version)',
  'Rita Hayworth and Shawshank Redemption',
  'The Canterville Ghost',
  'The Turn of the Screw',
  'The Phantom of the Opera',
  'The Hound of the Baskervilles',
  'Strangers on a Train',
  'The Lottery',
  'The Yellow Wallpaper',
  'The Tell-Tale Heart',
  "Don't Look Now",
  'What We Talk About When We Talk About Love',
];

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: 'GotchaAdmin2026!' }),
}).then((r) => r.json());
const token = login.accessToken;
const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

let ok = 0;
for (const title of EXPECTED) {
  const row = rows.find((r) => r.title === title);
  if (!row) {
    console.log('MISSING |', title);
    continue;
  }
  const pass =
    row.publishStatus === 'published' &&
    !row.coverImageKey &&
    row.wordCount >= 1500;
  console.log(
    pass ? 'OK' : 'WARN',
    '|',
    title,
    '|',
    row.wordCount,
    'words |',
    row.publishStatus,
    '| cover=',
    row.coverImageKey ?? 'none',
  );
  if (pass) ok += 1;
}
console.log(`\n${ok}/${EXPECTED.length} ready in production`);
