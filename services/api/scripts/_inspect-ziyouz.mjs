const url = process.argv[2] ?? 'https://ziyouz.uz/ozbek-nasri/gafur-gulom/gafur-gulom-shum-bola-qissa/';
const res = await fetch(url, {
  headers: { 'User-Agent': 'GotchaImporter/2.1 Mozilla/5.0' },
});
const html = await res.text();

function extractEntry(html) {
  const m =
    html.match(/<div class="entry-content[\s\S]*?<\/div>\s*<\/div>\s*<footer/i) ??
    html.match(/<div class="entry-content[\s\S]*?<\/div>/i);
  return m?.[0] ?? html;
}

function strip(fragment) {
  return fragment
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
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

const entry = extractEntry(html);
const text = strip(entry);
const words = (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
console.log('entry words', words);
console.log('sample', text.slice(0, 400));
const downloads = [...html.matchAll(/download=\d+:[^"'<>]+/gi)].map((m) => m[0]);
console.log('downloads', downloads);
