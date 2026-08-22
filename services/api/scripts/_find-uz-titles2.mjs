import { PDFParse } from 'pdf-parse';

const UA = { 'User-Agent': 'Mozilla/5.0' };

async function pdf(id, slug) {
  const url = `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=${id}:${slug}`;
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  return ((await parser.getText()).text ?? '').replace(/\r/g, '');
}

const t671 = await pdf(671, 'said-ahmad-tanlangan-asarlar-1-jild-hikoyalar');
const t714 = await pdf(714, 'tog-ay-murod-ot-kishnagan-oqshom-qissa');

for (const t of [
  'САРАНЖАМ', 'Saranjam', 'ҚОРАЧАГ', "Qorachag", 'МАФТУН', 'Maftuning', 'МОЙЛИОТ', 'Moyliot', "Mo'yliot",
  'УФҚ', 'UFQ', 'ОТ КИШНАГАН', 'MOYLIOT'
]) {
  const i671 = t671.search(new RegExp(t, 'i'));
  const i714 = t714.search(new RegExp(t, 'i'));
  console.log(t, '671:', i671 >= 0 ? `@${i671}` : '-', '714:', i714 >= 0 ? `@${i714}` : '-');
}

// TOC from 671 - first 15000 chars after MUNDARIJA
const tocIdx = t671.search(/MUNDARIJA|МУНДАРИЖА/i);
console.log('\nTOC 671:\n', t671.slice(tocIdx, tocIdx + 8000).replace(/\s+/g, ' '));

// TOC from 714
const toc714 = t714.search(/MUNDARIJA|МУНДАРИЖА|OT KISHNAGAN|ОТ КИШНАГАН/i);
console.log('\nTOC 714:\n', t714.slice(toc714, toc714 + 5000).replace(/\s+/g, ' '));

// Extract Qorachag from 671 if found
const qIdx = t671.search(/ҚОРАЧАГ|QORACHAG/i);
if (qIdx >= 0) console.log('\nQorachag context:', t671.slice(qIdx, qIdx + 200).replace(/\s+/g, ' '));
