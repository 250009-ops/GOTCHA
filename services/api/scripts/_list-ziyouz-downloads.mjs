const pages = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const all = new Set();
for (const p of pages) {
  const url =
    p === 1
      ? 'http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri'
      : `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?start=${(p - 1) * 20}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) {
    console.log('stop page', p, res.status);
    break;
  }
  const html = await res.text();
  const downloads = [...html.matchAll(/download=(\d+:[^"'<>]+)/gi)].map((m) => m[1]);
  if (!downloads.length) break;
  downloads.forEach((d) => all.add(d));
  console.log('page', p, 'count', downloads.length, 'total', all.size);
}

const NEED = [
  ['Dunyoning ishlari', /dunyoning/i],
  ['Shum bola', /shum-bola/i],
  ["Mening o'g'rigina", /ogrigina|o-g-rigina/i],
  ['Anor', /[^-]anor[^a-z]/i],
  ['Bemor', /bemor/i],
  ['Dahshat', /dahshat/i],
  ["O'g'ri", /o-g-ri[^q]/i],
  ['Oltin zanglamas', /oltin-zang/i],
  ['Muzqaymoq', /muzqaymoq/i],
  ['Urushning oxirgi', /urushning/i],
  ['Ufq', /\bufq\b/i],
  ['Saranjam', /saranjam/i],
  ["Qorachag'lar", /qorachag/i],
  ['Sinchalak', /sinchalak/i],
  ['Maftuningman', /maftun/i],
  ["O'tmishdan ertaklar", /otmishdan-ertaklar/i],
  ['Yulduzlar mangu', /yulduzlar-mangu/i],
  ['Otamdan qolgan', /otamdan-qolgan/i],
  ['Moyliot', /moyliot/i],
  ['Ot kishnagan', /kishnagan/i],
];

console.log('\n=== MATCHES ===');
for (const [title, re] of NEED) {
  const hits = [...all].filter((d) => re.test(d));
  console.log(title, hits[0] ?? 'NOT FOUND');
  if (hits.length > 1) hits.slice(1).forEach((h) => console.log('  alt', h));
}
