import { PDFParse } from 'pdf-parse';

const url =
  'http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=671:said-ahmad-tanlangan-asarlar-1-jild-hikoyalar';
const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
const text = (await parser.getText()).text ?? '';

for (const title of [
  'Саранжам',
  'Қорачағ',
  'Maftun',
  'Мафту',
  'Ufq',
  'Уфқ',
  'Muzqaymoq',
  'Музқаймоқ',
  'Moyliot',
  'Мойлиот',
  'Qorako',
  'Қорако',
]) {
  const idx = text.indexOf(title);
  console.log(title, idx >= 0 ? `found @${idx}` : 'NOT FOUND');
}

// dump table of contents chunk
const toc = text.match(/MUNDARIJA[\s\S]{0,3000}/i)?.[0] ?? text.slice(0, 4000);
console.log('\nTOC sample:\n', toc.replace(/\s+/g, ' ').slice(0, 2000));
