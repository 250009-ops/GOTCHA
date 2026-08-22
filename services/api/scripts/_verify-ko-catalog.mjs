const API = 'https://gotchaa.uz/api/v1';
const TITLES = [
  '운수 좋은 날',
  '동백꽃',
  '봄·봄',
  '메밀꽃 필 무렵',
  '소나기',
  '날개',
  '수난이대',
  '화사집/B사감과 러브레터',
  '사랑손님과 어머니',
  '감자',
  '배따라기',
  '광염 소나타',
  '발가락이 닮았다',
  '레디메이드 인생',
  '치숙',
  '태평천하 (절반 분권판)',
  '탁류 (발췌본)',
  '만세전',
  '표구된 휴지',
  '삼포 가는 길',
];

const login = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@gotcha.app', password: 'GotchaAdmin2026!' }),
}).then((r) => r.json());

const rows = await fetch(`${API}/admin/content/curriculum?type=all`, {
  headers: { Authorization: `Bearer ${login.accessToken}` },
}).then((r) => r.json());

const ko = rows.filter((r) => r.language === 'ko');
const byTitle = new Map(ko.map((r) => [r.title.trim().toLowerCase(), r]));

let ok = 0;
for (const t of TITLES) {
  const row = byTitle.get(t.toLowerCase());
  if (!row) {
    console.log('MISSING', t);
    continue;
  }
  const good =
    row.language === 'ko' &&
    row.publishStatus === 'published' &&
    row.coverImageKey &&
    (row.wordCount ?? 0) >= 400;
  console.log(
    good ? 'OK' : 'BAD',
    t,
    row.publishStatus,
    row.language,
    row.wordCount,
    row.coverImageKey ? 'cover=yes' : 'cover=no',
    row.id?.slice(0, 8),
  );
  if (good) ok += 1;
}
console.log(`\n${ok}/${TITLES.length} Korean curriculum items verified (published + cover)`);
