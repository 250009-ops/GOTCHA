/** Uzbek Cyrillic → Latin (1993 alphabet) + PDF/HTML cleanup helpers. */

const CYR_MULTI = [
  ['Ё', 'Yo'], ['ё', 'yo'],
  ['Ю', 'Yu'], ['ю', 'yu'],
  ['Я', 'Ya'], ['я', 'ya'],
  ['Ч', 'Ch'], ['ч', 'ch'],
  ['Ш', 'Sh'], ['ш', 'sh'],
  ['Щ', 'Sh'], ['щ', 'sh'],
  ['Ц', 'Ts'], ['ц', 'ts'],
  ['Ў', "O'"], ['ў', "o'"],
  ['Қ', 'Q'], ['қ', 'q'],
  ['Ғ', "G'"], ['ғ', "g'"],
  ['Ҳ', 'H'], ['ҳ', 'h'],
];

const CYR_SINGLE = {
  А: 'A', а: 'a', Б: 'B', б: 'b', В: 'V', в: 'v', Г: 'G', г: 'g', Д: 'D', д: 'd',
  Е: 'E', е: 'e', Ж: 'J', ж: 'j', З: 'Z', з: 'z', И: 'I', и: 'i', Й: 'Y', й: 'y',
  К: 'K', к: 'k', Л: 'L', л: 'l', М: 'M', м: 'm', Н: 'N', н: 'n', О: 'O', о: 'o',
  П: 'P', п: 'p', Р: 'R', р: 'r', С: 'S', с: 's', Т: 'T', т: 't', У: 'U', у: 'u',
  Ф: 'F', ф: 'f', Х: 'X', х: 'x', Ъ: "'", ъ: "'", Ь: '', ь: '', Э: 'E', э: 'e',
};

export function transliterateUzCyrillic(text) {
  let out = text;
  for (const [from, to] of CYR_MULTI) out = out.split(from).join(to);
  out = [...out].map((ch) => CYR_SINGLE[ch] ?? ch).join('');
  return out
    .replace(/`/g, "'")
    .replace(/ʼ/g, "'")
    .replace(/'/g, "'")
    .replace(/O'/g, "O'")
    .replace(/o'/g, "o'")
    .replace(/G'/g, "G'")
    .replace(/g'/g, "g'");
}

export function cyrRatio(text) {
  const letters = text.match(/[\p{L}]/gu) ?? [];
  if (!letters.length) return 0;
  return letters.filter((c) => /[\u0400-\u04FF]/.test(c)).length / letters.length;
}

export function cleanPdfArtifacts(text) {
  let out = text
    .replace(/www\.ziyouz\.com(?:\s+kutubxonasi)?(?:\s*--\s*\d+\s+of\s+\d+\s*--)?/gi, '')
    .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, '');
  if (out.includes('\n')) {
    out = out
      .split('\n')
      .filter((line) => {
        const t = line.trim();
        if (!t || t.length > 200) return true;
        const parts = t.split(/\s+/);
        const spacedTitle = parts.length >= 5 && parts.every((p) => p.length <= 2);
        return !spacedTitle;
      })
      .join('\n');
  }
  return out
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const NAV_LINE =
  /^(O.?Z|ЎЗ|РУ|EN|Maqolalar|Islom|Hikmatlar|Tarix|O['’ʻ`ʼ]zbek ziyolilari|Suhbatlar|Oila va jamiyat|Qiziqarli|Matbuot|Adabiyot|Ziyo istagan|Lotin|Kirill|Asar haqida|Muallif|Mundarija|Asarning to|Qur'oni|Hadisi|Facebook|Twitter|YouTube|Filter|Humo:|Saytimiz|©|E-mail|Feed|Arxiv|Menyu|ziyouz|←|→|Home|Bosh sahifa|Osnovnoye|Pereyti|soderjimomu|Portal tarixi|Mustaqillik matbuoti|Hozirgi davr|Perейти|Основное|Перейти|Меню)/i;

export function stripHtml(html) {
  const body = html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ?? html;
  let text = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  text = text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (NAV_LINE.test(t)) return false;
      if (/^https?:\/\//i.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Drop ziyouz tagline-only opener
  if (/^Ziyo istagan qalblar uchun!?\.?\s*$/i.test(text.split('\n')[0]?.trim() ?? '')) {
    text = text.split('\n').slice(1).join('\n').trim();
  }

  for (const marker of ['—', '–', '-']) {
    const idx = text.indexOf(marker);
    if (idx > 40 && idx < 400) {
      text = text.slice(idx + marker.length).trim();
      break;
    }
  }
  return text;
}

export function trimUzbekStoryStart(text) {
  const lines = text.split('\n');
  const idx = lines.findIndex((line) => {
    const t = line.trim();
    if (t.length < 30) return false;
    if (NAV_LINE.test(t)) return false;
    if (/^\d{1,2}\s+(yanvar|fevral|mart|aprel|may|iyun|iyul|avgust|sentyabr|oktyabr|noyabr|dekabr|ноября|января)/i.test(t)) return false;
    return countWords(t) >= 6;
  });
  if (idx > 0) return lines.slice(idx).join('\n').trim();
  return text;
}

export function toLatinUz(text) {
  const cleaned = cleanPdfArtifacts(text);
  if (cyrRatio(cleaned) < 0.08) return trimUzbekStoryStart(cleaned);
  return trimUzbekStoryStart(cleanPdfArtifacts(transliterateUzCyrillic(cleaned)));
}

export function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

export function hasNavJunk(text) {
  return /O.?Z\s+ЎЗ\s+РУ\s+EN|Maqolalar Islom Hikmatlar|^Ziyo istagan qalblar|Osnovnoye menyu|Pereyti k soderjimomu|Основное меню/i.test(
    text.slice(0, 800),
  );
}

export function needsLatinFix(text) {
  return cyrRatio(text) > 0.2 || hasNavJunk(text) || countWords(text) < 50;
}
