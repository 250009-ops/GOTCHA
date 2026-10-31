const url = 'https://ziyouz.uz/ozbek-nasri/otkir-hoshimov/';
const html = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }).then((r) => r.text());
const links = [...new Set([...html.matchAll(/href="(https:\/\/ziyouz\.uz\/ozbek-nasri\/otkir-hoshimov[^"]+)"/gi)].map((m) => m[1]))];
for (const link of links) {
  if (link.endsWith('/otkir-hoshimov/')) continue;
  const page = await fetch(link).then((r) => r.text());
  const title = page.match(/<h1 class="entry-title">([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim();
  const entry = page.match(/<div class="entry-content[\s\S]*?<\/div>\s*<\/div>/i)?.[0] ?? '';
  const words = (entry.replace(/<[^>]+>/g, ' ').match(/[\p{L}\p{M}']+/gu) ?? []).length;
  console.log(`${words}w\t${title}\n  ${link}`);
  await new Promise((r) => setTimeout(r, 150));
}
