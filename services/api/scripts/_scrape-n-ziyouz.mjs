const AUTHORS = [
  'otkir-hoshimov-1941-2013',
  'g-afur-g-ulom-1903-1966',
  'abdulla-qahhor-1907-1968',
  'odil-yoqubov',
  'said-ahmad',
  'sadriddin-ayniy',
  'tog-ay-murod',
];

const NEED = [
  'dunyoning',
  'shum-bola',
  'ogrigina',
  'anor',
  'bemor',
  'dahshat',
  'ogri',
  'oltin-zang',
  'muzqaymoq',
  'urushning',
  'ufq',
  'saranjam',
  'qorachag',
  'sinchalak',
  'maftun',
  'otmishdan',
  'yulduzlar',
  'otamdan',
  'moyliot',
  'kishnagan',
];

for (const author of AUTHORS) {
  const url = `https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/${author}/`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
  console.log('\n===', author, res.status, '===');
  if (!res.ok) continue;
  const html = await res.text();
  const links = [...html.matchAll(/href="(\/portal-haqida\/xarita\/uzbek-nasri\/[^"]+)"/gi)].map((m) => m[1]);
  const uniq = [...new Set(links)].filter((l) => NEED.some((k) => l.toLowerCase().includes(k)));
  for (const link of uniq) {
    const full = `https://n.ziyouz.com${link}`;
    const page = await fetch(full, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const ph = await page.text();
    const title = ph.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
    const text = ph.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    const words = (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
    console.log(`${words}w ${title ?? link}`);
    console.log(`  ${full}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}
