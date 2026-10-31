/** Build kutubxona download index (may take a few minutes). */
const all = new Map();
for (let start = 0; start <= 5000; start += 20) {
  const url =
    start === 0
      ? 'http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri'
      : `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?start=${start}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) break;
  const html = await res.text();
  const titles = [...html.matchAll(/<a[^>]+href="[^"]*download=(\d+:[^"'&<>]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)];
  if (!titles.length) break;
  for (const m of titles) {
    const slug = m[1].replace(/&amp;.*$/, '');
    const title = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (!all.has(slug)) all.set(slug, title);
  }
  if (start % 200 === 0) console.error('start', start, 'unique', all.size);
}
console.error('TOTAL', all.size);

const NEED = [
  'dunyoning', 'shum', 'ogrigina', 'o-g-rigina', 'anor', 'bemor', 'dahshat', 'o-g-ri',
  'oltin-zang', 'muzqaymoq', 'urushning', 'ufq', 'saranjam', 'qorachag', 'sinchalak',
  'maftun', 'otmishdan', 'yulduzlar-mangu', 'otamdan', 'moyliot', 'kishnagan',
  'hoshimov', 'said', 'ayniy', 'yoqubov', 'tog-ay',
];

for (const [slug, title] of all) {
  const hay = `${slug} ${title}`.toLowerCase();
  if (NEED.some((k) => hay.includes(k))) {
    console.log(`${slug}\t${title}`);
  }
}
