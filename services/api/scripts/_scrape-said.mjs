const url = 'https://ziyouz.uz/ozbek-nasri/said-ahmad/';
const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
const links = [...new Set([...html.matchAll(/href="(https:\/\/ziyouz\.uz\/ozbek-nasri\/said-ahmad[^"]+)"/gi)].map((m) => m[1]))];
for (const link of links) {
  if (!link.includes('said-ahmad/')) continue;
  const page = await fetch(link).then((r) => r.text());
  const title = page.match(/<h1 class="entry-title">([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
  const words = (page.match(/entry-content[\s\S]*?<\/div>/i)?.[0] ?? page)
    .replace(/<[^>]+>/g, ' ')
    .match(/[\p{L}\p{M}']+/gu)?.length ?? 0;
  console.log(`${words}w\t${title ?? link}\n  ${link}`);
  await new Promise((r) => setTimeout(r, 150));
}
