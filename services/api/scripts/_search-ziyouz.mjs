const queries = [
  'dunyoning ishlari otkir',
  'muzqaymoq otkir',
  'urushning oxirgi qurboni',
  'ufq said ahmad',
  'saranjam xotin',
  'qorachaglar said',
  'maftuningman',
  'oltin zanglamas odil',
  'otmishdan ertaklar ayniy',
  'moyliot togay',
];

async function search(q) {
  const url = `https://ziyouz.uz/?s=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const links = [...html.matchAll(/href="(https:\/\/ziyouz\.uz\/ozbek-nasri\/[^"]+)"/gi)].map((m) => m[1]);
  const titles = [...html.matchAll(/entry-title[\s\S]*?<a[^>]+href="[^"]+"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) =>
    m[1].replace(/<[^>]+>/g, '').trim(),
  );
  console.log('\nQ:', q);
  [...new Set(links)].slice(0, 5).forEach((l, i) => console.log(' ', titles[i] ?? '', l));
}

for (const q of queries) {
  await search(q);
  await new Promise((r) => setTimeout(r, 400));
}
