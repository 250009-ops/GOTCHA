/** Quick probe for lib-ebooks paginated fetch. */
const BASE = process.argv[2];
if (!BASE) {
  console.error('Usage: node lib-ebooks-fetch.mjs <base-url-without-suffix>');
  process.exit(1);
}

const suffixes = ['', ...'abcdefghijklmnopqrstuvwxyz'.split('').map((c) => `_${c}`)];

function strip(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
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

async function main() {
  let text = '';
  for (const suffix of suffixes) {
    const url = `${BASE.replace(/\/$/, '')}${suffix}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'GotchaImporter/2.1' } });
    if (!res.ok) break;
    const html = await res.text();
    const chunk = strip(html);
    const words = (chunk.match(/[\p{L}\p{M}']+/gu) ?? []).length;
    if (words < 80) break;
    text += `\n\n${chunk}`;
    console.log(`${suffix || '(root)'}: +${words} words`);
  }
  const total = (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
  console.log('TOTAL', total);
  console.log(text.slice(0, 300).replace(/\n/g, ' '));
}

main().catch(console.error);
