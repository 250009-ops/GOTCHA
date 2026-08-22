/**
 * Scrape ziyouz author indexes for article + PDF download links.
 */
const AUTHORS = [
  ['otkir-hoshimov', 'https://ziyouz.uz/ozbek-nasri/otkir-hoshimov/'],
  ['gafur-gulom', 'https://ziyouz.uz/ozbek-nasri/gafur-gulom/'],
  ['abdulla-qahhor', 'https://ziyouz.uz/ozbek-nasri/abdulla-qahhor/'],
  ['odil-yoqubov', 'https://ziyouz.uz/ozbek-nasri/odil-yoqubov/'],
  ['said-ahmad', 'https://ziyouz.uz/ozbek-nasri/said-ahmad/'],
  ['sadriddin-ayniy', 'https://ziyouz.uz/ozbek-nasri/sadriddin-ayniy/'],
  ['togay-murod', 'https://ziyouz.uz/ozbek-nasri/togay-murod/'],
];

const NEED = [
  'dunyoning',
  'shum',
  'ogrigina',
  'anor',
  'bemor',
  'dahshat',
  'ogri',
  'oltin',
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

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return res.ok ? res.text() : '';
}

async function main() {
  for (const [slug, url] of AUTHORS) {
    const html = await fetchHtml(url);
    const links = [...html.matchAll(/href="(https:\/\/ziyouz\.uz\/ozbek-nasri\/[^"]+)"/gi)].map((m) => m[1]);
    const uniq = [...new Set(links)].filter((u) => NEED.some((k) => u.toLowerCase().includes(k)));
    console.log('\n===', slug, '===');
    for (const link of uniq) {
      const page = await fetchHtml(link);
      const title = page.match(/<h1 class="entry-title">([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
      const dl = page.match(/download=(\d+:[^"'<>]+)/i)?.[1];
      console.log(title ?? link);
      console.log('  page:', link);
      console.log('  download:', dl ?? 'none');
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

main();
