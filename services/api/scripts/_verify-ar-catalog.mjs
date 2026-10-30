/** Verify Arabic curriculum on production. */
const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

const TITLES = [
  '\u0642\u0646\u062f\u064a\u0644 \u0623\u0645 \u0647\u0627\u0634\u0645',
  '\u0645\u0648\u0633\u0645 \u0627\u0644\u0647\u062c\u0631\u0629 \u0625\u0644\u0649 \u0627\u0644\u0634\u0645\u0627\u0644 (\u0641\u0635\u0648\u0644 \u0645\u062e\u062a\u0627\u0631\u0629)',
  '\u062f\u0648\u0645\u0629 \u0648\u062f \u062d\u0627\u0645\u062f',
  '\u0639\u0635\u0641\u0648\u0631 \u0645\u0646 \u0627\u0644\u0634\u0631\u0642 (\u0637\u0628\u0639\u0629 \u0645\u0628\u0633\u0637\u0629)',
  '\u0623\u0631\u0646\u064a \u0627\u0644\u0644\u0647',
  '\u0623\u0631\u062e\u0635 \u0644\u064a\u0627\u0644\u064a',
  '\u0627\u0644\u0646\u062f\u0627\u0647\u0629',
  '\u0628\u064a\u062a \u0645\u0646 \u0644\u062d\u0645',
  '\u0646\u0638\u0631\u0629',
  '\u0642\u0627\u0639 \u0627\u0644\u0645\u062f\u064a\u0646\u0629',
  '\u0632\u0639\u0628\u0644\u0627\u0648\u064a',
  '\u062f\u0646\u064a\u0627 \u0627\u0644\u0644\u0647',
  '\u0647\u0645\u0633 \u0627\u0644\u062c\u0646\u0648\u0646',
  '\u062d\u0643\u0627\u064a\u0629 \u0628\u0644\u0627 \u0628\u062f\u0627\u064a\u0629 \u0648\u0644\u0627 \u0646\u0647\u0627\u064a\u0629',
  '\u0627\u0644\u0634\u0631\u064a\u062f\u0629',
  '\u0631\u062c\u0627\u0644 \u0641\u064a \u0627\u0644\u0634\u0645\u0633',
  '\u0639\u0627\u0626\u062f \u0625\u0644\u0649 \u062d\u064a\u0641\u0627',
  '\u0623\u0645 \u0633\u0639\u062f',
  '\u0645\u0648\u062a \u0633\u0631\u064a\u0631 \u0631\u0642\u0645 12',
  '\u0623\u0631\u0636 \u0627\u0644\u0628\u0631\u062a\u0642\u0627\u0644 \u0627\u0644\u062d\u0632\u064a\u0646',
];

const token = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
})
  .then((r) => r.json())
  .then((j) => j.accessToken);

const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

const ar = rows.filter((r) => r.language === 'ar');
const byTitle = new Map(ar.map((r) => [r.title.trim(), r]));

let ok = 0;
for (const title of TITLES) {
  const row = byTitle.get(title);
  const cover = row?.coverImageKey ? 'cover' : 'NO COVER';
  const pub = row?.publishStatus === 'published' ? 'published' : row?.publishStatus ?? 'MISSING';
  const status = row && row.publishStatus === 'published' && row.coverImageKey ? 'OK' : 'BAD';
  if (status === 'OK') ok += 1;
  console.log(`${status} | ${title} | ${pub} | ${cover}`);
}
console.log(`\n${ok}/${TITLES.length} Arabic titles verified`);
