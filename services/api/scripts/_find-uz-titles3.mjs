import { PDFParse } from 'pdf-parse';

const UA = { 'User-Agent': 'Mozilla/5.0' };
async function pdf(id, slug) {
  const url = `http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=${id}:${slug}`;
  const res = await fetch(url, { headers: UA, redirect: 'follow' });
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  return ((await parser.getText()).text ?? '').replace(/\r/g, '');
}

const ufq = await pdf(6216, 'said-ahmad-ufq-trilogiya');
const t717 = await pdf(717, 'tog-ay-murod-tanlangan-asarlar-1-jild');

for (const t of ['SARANJAM', 'Saranjam', 'MAFTUNING', 'Maftuning', 'MOYLIOT', 'Moyliot', 'QORACHAG', 'Qorachag']) {
  console.log(t, 'ufq:', ufq.search(new RegExp(t, 'i')) >= 0 ? `@${ufq.search(new RegExp(t, 'i'))}` : '-', '717:', t717.search(new RegExp(t, 'i')) >= 0 ? `@${t717.search(new RegExp(t, 'i'))}` : '-');
}

// Ufq TOC
const toc = ufq.match(/MUNDARIJA[\s\S]{0,5000}/i)?.[0] ?? ufq.slice(0, 6000);
console.log('\nUfq TOC:\n', toc.replace(/\s+/g, ' ').slice(0, 2500));

console.log('\n717 TOC:\n', t717.slice(0, 4000).replace(/\s+/g, ' '));

// Extract Sarob from 671
const t671 = await pdf(671, 'said-ahmad-tanlangan-asarlar-1-jild-hikoyalar');
const sarob = t671.search(/САРОБ| Sarob/i);
console.log('\nSarob in 671:', sarob);
