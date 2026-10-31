const terms = [
  'hoshimov',
  'dunyoning',
  'muzqaymoq',
  'said ahmad',
  'ufq',
  'togay',
  'moyliot',
  'ayniy',
  'yoqubov',
  'zanglamas',
  'ogrigina',
  'qorachag',
  'saranjam',
  'maftun',
  'urushning',
];

for (const term of terms) {
  const url = `http://n.ziyouz.com/kutubxona/search?searchword=${encodeURIComponent(term)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const downloads = [...new Set([...html.matchAll(/download=(\d+:[^"'&<>]+)/gi)].map((m) => m[1]))];
  console.log('\n', term, 'hits', downloads.length);
  downloads.slice(0, 8).forEach((d) => console.log(' ', d));
  await new Promise((r) => setTimeout(r, 300));
}
