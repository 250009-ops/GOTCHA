import JSZip from 'jszip';
import * as cheerio from 'cheerio';

function htmlToCleanText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, header, footer').remove();
  return $('body').text().replace(/\s+/g, ' ').trim();
}

const res = await fetch('https://library.peridot.systems/download/1104/epub/1104.epub');
const buf = Buffer.from(await res.arrayBuffer());
const zip = await JSZip.loadAsync(buf);
const names = Object.keys(zip.files)
  .filter((n) => /index1_split_\d+\.html$/i.test(n) && !zip.files[n].dir)
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
let all = '';
for (const name of names) {
  const html = await zip.file(name).async('string');
  const text = htmlToCleanText(html);
  all += text + '\n\n';
}
const words = (all.match(/[\p{L}\p{M}']+/gu) ?? []).length;
console.log('files', names.length, 'words', words);
console.log('start', all.slice(0, 200));
console.log('end', all.slice(-400));
