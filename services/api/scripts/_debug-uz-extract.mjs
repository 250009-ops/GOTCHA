import { PDFParse } from 'pdf-parse';

const UA = { 'User-Agent': 'Mozilla/5.0' };

async function bimm() {
  const res = await fetch('https://lib.bimm.uz/items/download/10396', { headers: UA });
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  return ((await parser.getText()).text ?? '').replace(/\r/g, '');
}

async function pdf(id, slug) {
  const res = await fetch(`http://n.ziyouz.com/kutubxona/category/41-o-zbek-nasri?download=${id}:${slug}`, { headers: UA });
  const parser = new PDFParse(new Uint8Array(await res.arrayBuffer()));
  const out = await parser.getText();
  return out.text ?? '';
}

const b = await bimm();
for (const q of ['URUSHNING', 'Urushning', 'SO\'NGGI', 'SONGGI', 'oxirgi', 'OXIRGI', 'qurboni', 'QURBONI']) {
  const i = b.search(new RegExp(q, 'i'));
  console.log('bimm', q, i >= 0 ? `@${i} :: ${b.slice(i, i + 80).replace(/\s+/g, ' ')}` : '-');
}

for (const [id, slug, name] of [
  [6216, 'said-ahmad-ufq-trilogiya', 'ufq'],
  [11862, 'sadriddin-ayniy-otmishdan-ertaklar', 'ertaklar'],
  [715, 'tog-ay-murod-otamdan-qolgan-dalalar-roman', 'otamdan'],
]) {
  try {
    const t = await pdf(id, slug);
    console.log(name, 'len', t?.length ?? 'null', 'words', (t?.match(/[\p{L}\p{M}']+/gu) ?? []).length);
  } catch (e) {
    console.log(name, 'ERR', e.message);
  }
}
