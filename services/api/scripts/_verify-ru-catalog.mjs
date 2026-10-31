/** Verify all 20 Russian curriculum titles on production. */
const API = 'https://gotchaa.uz/api/v1';
const EXPECTED = [
  'Пиковая дама',
  'Шинель',
  'Белые ночи',
  'Каштанка',
  'Смерть Ивана Ильича',
  'Нос',
  'Дама с собачкой',
  'Первая любовь',
  'Человек в футляре',
  'Сон смешного человека',
  'Палата № 6',
  'Станционный смотритель',
  'Выстрел',
  'Муму',
  'Портрет',
  'Леди Макбет Мценского уезда',
  'Хозяин и работник',
  'Крейцерова соната',
  'Ася',
  'Чёрный монах',
];

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: '<REDACTED-admin-pw>' }),
}).then((r) => r.json());
const token = login.accessToken;
const rows = await fetch(`${API}/admin/content/curriculum?type=all&language=ru`, {
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
    row.language === 'ru' &&
    !row.coverImageKey &&
    row.wordCount >= 500;
  console.log(
    pass ? 'OK' : 'WARN',
    '|',
    title,
    '|',
    row.wordCount,
    'words |',
    row.cefrLevel,
    '| cover=',
    row.coverImageKey ?? 'none',
  );
  if (pass) ok += 1;
}
console.log(`\n${ok}/${EXPECTED.length} Russian titles ready in production`);
