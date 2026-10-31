import { PDFParse } from 'pdf-parse';
const UA = { 'User-Agent': 'Mozilla/5.0' };
const res = await fetch('http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=717:tog-ay-murod-tanlangan-asarlar-1-jild', { headers: UA, redirect: 'follow' });
const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
const text = ((await parser.getText()).text ?? '').replace(/\r/g, '');

// find all caps titles
const titles = [...text.matchAll(/\n([A-ZА-ЯЁҒҚҲЎІ][^\n]{3,60})\n/g)].map(m => m[1].trim()).filter(t => t.length < 50);
const uniq = [...new Set(titles)];
console.log('Sample titles:', uniq.slice(0, 40).join('\n'));

for (const k of ['MOY', 'Moy', 'МОЙ', 'YULDUZ', 'OT KISH', 'OYDIN', 'MOMO']) {
  const i = text.search(new RegExp(k, 'i'));
  if (i >= 0) console.log(k, '@', i, text.slice(i, i+80).replace(/\s+/g,' '));
}
