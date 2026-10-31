/** Fetch full text from ilibrary.ru paginated pages. */
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/[^>]+>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

async function fetchIlibraryText(id, maxPages = 80) {
  const parts = [];
  for (let p = 1; p <= maxPages; p += 1) {
    const urls = [
      `https://ilibrary.ru/text/${id}/p.${p}.html`,
      `https://ilibrary.ru/text/${id}/p.${p}/index.html`,
    ];
    let html = '';
    for (const url of urls) {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' } });
      if (res.ok) {
        html = await res.text();
        break;
      }
    }
    if (!html) break;
    const text = strip(html);
    const words = (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
    if (words < 80) break;
    parts.push(text);
    process.stdout.write(`${p}:${words} `);
  }
  return parts.join('\n\n');
}

const ids = [
  ['480', 'Пиковая дама'],
  ['989', 'Палата № 6'],
  ['73', 'Шинель?'],
  ['109', 'unknown109'],
];

for (const [id, title] of ids) {
  console.log(`\n${title} (${id})`);
  const text = await fetchIlibraryText(id);
  const words = (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
  console.log(`\nTOTAL ${words}`);
  console.log('START', text.slice(0, 120).replace(/\s+/g, ' '));
  console.log('END', text.slice(-120).replace(/\s+/g, ' '));
}
