/**
 * Probe ziyouz.uz URLs for Uzbek catalog titles.
 * Usage: node services/api/scripts/_probe-uz-sources.mjs
 */
const CANDIDATES = [
  ['Dunyoning ishlari', 'https://ziyouz.uz/ozbek-nasri/otkir-hoshimov/otkir-hoshimov-dunyoning-ishlari-qissa/'],
  ['Dunyoning ishlari alt', 'https://ziyouz.uz/ozbek-nasri/otkir-hoshimov/dunyoning-ishlari/'],
  ['Shum bola', 'https://ziyouz.uz/ozbek-nasri/gafur-gulom/gafur-gulom-shum-bola-qissa/'],
  ["Mening o'g'rigina bolam", 'https://ziyouz.uz/ozbek-nasri/gafur-gulom/gafur-gulom-mening-ogrigina-bolam-hikoya/'],
  ['Anor', 'https://ziyouz.uz/ozbek-nasri/abdulla-qahhor/abdulla-qahhor-anor-hikoya/'],
  ['Bemor', 'https://ziyouz.uz/ozbek-nasri/abdulla-qahhor/abdulla-qahhor-bemor-hikoya/'],
  ['Dahshat', 'https://ziyouz.uz/ozbek-nasri/abdulla-qahhor/abdulla-qahhor-dahshat-hikoya/'],
  ["O'g'ri", 'https://ziyouz.uz/ozbek-nasri/abdulla-qahhor/abdulla-qahhor-ogri-hikoya/'],
  ['Oltin zanglamas', 'https://ziyouz.uz/ozbek-nasri/odil-yoqubov/odil-yoqubov-oltin-zanglamas-qissa/'],
  ['Muzqaymoq', 'https://ziyouz.uz/ozbek-nasri/otkir-hoshimov/otkir-hoshimov-muzqaymoq-qissa/'],
  ['Urushning oxirgi qurboni', 'https://ziyouz.uz/ozbek-nasri/otkir-hoshimov/otkir-hoshimov-urushning-oxirgi-qurboni-hikoya/'],
  ['Ufq', 'https://ziyouz.uz/ozbek-nasri/said-ahmad/said-ahmad-ufq-hikoya/'],
  ['Saranjam xotin', 'https://ziyouz.uz/ozbek-nasri/said-ahmad/said-ahmad-saranjam-xotin-hikoya/'],
  ["Qorachag'lar", 'https://ziyouz.uz/ozbek-nasri/said-ahmad/said-ahmad-qorachaglar-hikoya/'],
  ['Sinchalak', 'https://ziyouz.uz/ozbek-nasri/abdulla-qahhor/abdulla-qahhor-sinchalak-hikoya/'],
  ['Maftuningman', 'https://ziyouz.uz/ozbek-nasri/said-ahmad/said-ahmad-maftuningman-hikoya/'],
  ["O'tmishdan ertaklar", 'https://ziyouz.uz/ozbek-nasri/sadriddin-ayniy/sadriddin-ayniy-otmishdan-ertaklar/'],
  ['Yulduzlar mangu yonadi', 'https://ziyouz.uz/ozbek-nasri/togay-murod/togay-murod-yulduzlar-mangu-yonadi-roman/'],
  ["Otamdan qolgan dalalar", 'https://ziyouz.uz/ozbek-nasri/togay-murod/togay-murod-otamdan-qolgan-dalalar-roman/'],
  ['Moyliot', 'https://ziyouz.uz/ozbek-nasri/togay-murod/togay-murod-moyliot-qissa/'],
  ['Ot kishnagan oqshom', 'https://ziyouz.uz/ozbek-nasri/togay-murod/togay-murod-ot-kishnagan-oqshom-hikoya/'],
];

function strip(html) {
  const body = html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ?? html;
  return body
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

function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

function hasLatin(text) {
  return /[a-zA-Z]{4,}/.test(text) && !/^(PDF|Joomla|Ziyouz)/i.test(text);
}

async function probe(name, url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    const text = strip(html);
    const words = countWords(text);
    const ok = res.ok && words >= 500 && /[\u0400-\u04FF\u0600-\u06FF]/.test(text.slice(0, 500));
    const sample = text.slice(0, 120).replace(/\s+/g, ' ');
    console.log(`${ok ? 'OK' : 'BAD'} ${words}w ${res.status} ${name}`);
    console.log(`   ${url}`);
    if (ok) console.log(`   ${sample}`);
    return ok ? { name, url, words } : null;
  } catch (err) {
    console.log(`ERR ${name}: ${err.message}`);
    return null;
  }
}

async function main() {
  const ok = [];
  for (const [name, url] of CANDIDATES) {
    const r = await probe(name, url);
    if (r) ok.push(r);
    await new Promise((r) => setTimeout(r, 300));
  }
  console.log('\n=== WORKING ===');
  for (const r of ok) console.log(`${r.name}: ${r.url} (${r.words} words)`);
}

main();
