const urls = [
  'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/g-afur-g-ulom-1903-1966/g-afur-g-ulom-mening-o-g-rigina-bolam-hikoya',
  'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/abdulla-qahhor-1907-1968/abdulla-qahhor-o-g-ri-hikoya',
  'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-xotin-hikoya',
  'https://n.ziyouz.com/portal-haqida/xarita/uzbek-nasri/said-ahmad-1920-2007/said-ahmad-qorako-z-majnun-hikoya',
];
for (const url of urls) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const w = (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
  console.log(res.status, w + 'w', url.split('/').pop());
}
