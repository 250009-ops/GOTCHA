const authors = [
  'abdulla-qahhor-1907-1968',
  'g-afur-g-ulom-1903-1966',
];

for (const author of authors) {
  const url = `https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/${author}/`;
  const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
  const links = [...new Set([...html.matchAll(/href="(\/portal-haqida\/xarita\/uzbek-nasri\/[^"?]+)"/gi)].map((m) => m[1]))];
  console.log('\n===', author, '===');
  for (const link of links.filter((l) => l.includes(author) && l.split('/').length > 5)) {
    const full = `https://n.ziyouz.com${link}`;
    const page = await fetch(full).then((r) => r.text());
    const title = page.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
    const words = (page.replace(/<[^>]+>/g, ' ').match(/[\p{L}\p{M}']+/gu) ?? []).length;
    console.log(`${words}w\t${title}`);
    console.log(`  ${full}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}
