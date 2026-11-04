/**
 * Bulk-import the curated Arabic curriculum into the admin Content Library.
 * Fetches archive.org djvu.txt locally and sends plainText to ingest-preview.
 *
 * Usage:
 *   node services/api/scripts/import-arabic-catalog.mjs
 */
const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

function arabicStats(text) {
  const arabic = (text.match(/[\u0600-\u06FF]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return { arabic, latin, words: countWords(text) };
}

function assertArabic(text, label) {
  const s = arabicStats(text);
  if (s.words < 400) throw new Error(`${label}: too few words (${s.words})`);
  if (s.arabic <= s.latin) {
    throw new Error(`${label}: expected Arabic-heavy text (ar=${s.arabic}, latin=${s.latin})`);
  }
  return s.words;
}

function excerptWords(text, maxWords) {
  const parts = text.split(/\s+/);
  if (parts.length <= maxWords) return text;
  return parts.slice(0, maxWords).join(' ').trim();
}

function halfVolume(text) {
  const words = text.split(/\s+/);
  return words.slice(0, Math.ceil(words.length / 2)).join(' ').trim();
}

function trimFromMarkers(text, markers) {
  const headLimit = Math.max(500, Math.floor(text.length * 0.3));
  let best = -1;
  for (const marker of markers) {
    const idx = text.indexOf(marker);
    if (idx >= 60 && idx <= headLimit && idx > best) best = idx;
  }
  return best >= 0 ? text.slice(best).trim() : text;
}

function cleanOcr(text) {
  return text
    .replace(/\r/g, '')
    .replace(/hindawi@hindawi\.org/gi, ' ')
    .replace(/https?:\/\/www\.hindawi\.org[^\s]*/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function sliceBetween(text, startMarker, endMarkers = []) {
  const start = text.indexOf(startMarker);
  if (start < 0) throw new Error(`Start marker not found: ${startMarker}`);
  let end = text.length;
  for (const marker of endMarkers) {
    const idx = text.indexOf(marker, start + startMarker.length + 80);
    if (idx > start && idx < end) end = idx;
  }
  return text.slice(start, end).trim();
}

async function fetchArchiveDjvu(id) {
  const meta = await fetch(`https://archive.org/metadata/${id}`, {
    headers: { 'User-Agent': UA },
  }).then((r) => r.json());
  const file = (meta.files ?? []).find((f) => /djvu\.txt$/i.test(f.name ?? ''));
  if (!file) throw new Error(`No djvu.txt on archive item ${id}`);
  const url = `https://archive.org/download/${id}/${encodeURIComponent(file.name)}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  const text = cleanOcr(await res.text());
  return { plainText: text, sourceUrl: url, words: countWords(text) };
}

async function fromArchive(id, { trimMarkers, transform } = {}) {
  const { plainText, sourceUrl } = await fetchArchiveDjvu(id);
  let text = plainText;
  if (trimMarkers?.length) text = trimFromMarkers(text, trimMarkers);
  if (transform) text = transform(text);
  const words = assertArabic(text, id);
  return { plainText: text, sourceUrl, words };
}

/** @type {Array<{ title: string; author: string; contentType: 'book' | 'story'; cefrLevel: string; genre: string; description: string; resolve: () => Promise<{ plainText: string; sourceUrl: string; words: number }> }>} */
const CATALOG = [
  {
    title: 'قنديل أم هاشم',
    author: 'يحيى حقي',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'رواية عن الصراع بين العلم والتقاليد في القاهرة.',
    resolve: () =>
      fromArchive('20250827_20250827_1132', {
        trimMarkers: ['كان جدي', 'كان جدى', 'إسماعيل'],
      }),
  },
  {
    title: 'موسم الهجرة إلى الشمال (فصول مختارة)',
    author: 'الطيب صالح',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'فصول مختارة من رواية مصطفى سعيد ومحجوب.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('hazem_gelany_hotmail');
      const trimmed = trimFromMarkers(plainText, ['عدت الى أهلي', 'عدت إلى أهلي', 'محجوب']);
      const text = excerptWords(trimmed, 9000);
      const words = assertArabic(text, 'موسم excerpt');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'دومة ود حامد',
    author: 'الطيب صالح',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة من مجموعة دومة ود حامد.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('10_0828');
      const start = plainText.indexOf('دومة ود حامد');
      if (start < 0) throw new Error('دومة story not found');
      const end = plainText.indexOf('5 / 4', start + 500);
      const text = plainText.slice(start, end > start ? end : start + 45000).trim();
      const words = assertArabic(text, 'دومة');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'عصفور من الشرق (طبعة مبسطة)',
    author: 'توفيق الحكيم',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'رواية فلسفية عن عودة شاب مصري من أوروبا (نسخة مختصرة).',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('fkhettaf_gmail_20190412');
      const trimmed = trimFromMarkers(plainText, ['عصفور من الشرق', 'عصفور']);
      const text = excerptWords(trimmed, 7000);
      const words = assertArabic(text, 'عصفور excerpt');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'أرني الله',
    author: 'توفيق الحكيم',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'مسرحية قصيرة في الحوار الفلسفي.',
    resolve: () => fromArchive('elshandawily13340', { trimMarkers: ['أرني الله'] }),
  },
  {
    title: 'أرخص ليالي',
    author: 'يوسف إدريس',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة عبد الكريم وعائلته في الليل.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('1_20240615_20240615_2021');
      const anchor = plainText.indexOf('وأخيرًا استقر في وسط داره');
      if (anchor < 0) throw new Error('أرخص ليالي anchor not found');
      const text = excerptWords(plainText.slice(anchor), 12000);
      const words = assertArabic(text, 'أرخص ليالي');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'النداهة',
    author: 'يوسف إدريس',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة حامد والمشهد المروّع في بيته.',
    resolve: () =>
      fromArchive('20210415_20210415_2023', {
        trimMarkers: ['حين دفع', 'النداهة', 'حامد'],
      }),
  },
  {
    title: 'بيت من لحم',
    author: 'يوسف إدريس',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة عن أسرة فقيرة في حارة cairoية.',
    resolve: () =>
      fromArchive('1_20240615_20240615_2026', {
        trimMarkers: ['بيت من لحم', 'الثلاثين', 'بناتها'],
      }),
  },
  {
    title: 'نظرة',
    author: 'يوسف إدريس',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة قصيرة عن سؤال طفلة غريب.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('1_20240615_20240615_2021');
      const anchor = plainText.indexOf('كان غريبًا أن تسأل');
      if (anchor < 0) throw new Error('نظرة story anchor not found');
      const endCandidates = ['أرخص ليالي', 'بيت من', 'قاع المدينة', 'الطريق'].map((m) =>
        plainText.indexOf(m, anchor + 200),
      ).filter((i) => i > anchor);
      const end = endCandidates.length ? Math.min(...endCandidates) : anchor + 12000;
      const text = plainText.slice(anchor, end).trim();
      const words = assertArabic(text, 'نظرة');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'قاع المدينة',
    author: 'يوسف إدريس',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة عن عائشة في أحياء القاهرة الدنيا.',
    resolve: () =>
      fromArchive('1_20240615_20240615_2036', {
        trimMarkers: ['قاع المدينة', 'عائشة', 'وشعبان'],
      }),
  },
  {
    title: 'زعبلاوي',
    author: 'نجيب محفوظ',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'رحلة البحث عن الرجل المقدّس زعبلاوي.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('boygeniusegy_gmail_20180918_1520');
      const text = sliceBetween(plainText, 'زعبلاوي.', ['حنظل', 'مندوب فوق', 'الحجتار']).replace(
        /^زعبلاوي\.?\s*/u,
        '',
      );
      const words = assertArabic(text, 'زعبلاوي');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'دنيا الله',
    author: 'نجيب محفوظ',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة موظفي الدولة في مكتب حكومي.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('Heliopolis1957_gmail_20180606_2155');
      const text = excerptWords(
        plainText.slice(plainText.indexOf('دبت الحياة في إدارة السكرتارية')),
        8000,
      );
      const words = assertArabic(text, 'دنيا الله');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'همس الجنون',
    author: 'نجيب محفوظ',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'أول مجموعة قصصية لنجيب محفوظ.',
    resolve: () =>
      fromArchive('Heliopolis1957_gmail_20180607_2145', {
        trimMarkers: ['ما الجنون', 'همس الجنون'],
      }),
  },
  {
    title: 'حكاية بلا بداية ولا نهاية',
    author: 'نجيب محفوظ',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة عن التمرد والكفاح من أجل الاستقلال.',
    resolve: () =>
      fromArchive('Heliopolis1957_gmail_20190202_0153', {
        trimMarkers: ['حكاية بلا بداية', 'سيدةٌ بمقتبل'],
      }),
  },
  {
    title: 'الشريدة',
    author: 'نجيب محفوظ',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة زينب هانم وحسونة.',
    resolve: async () => {
      const { plainText, sourceUrl } = await fetchArchiveDjvu('Heliopolis1957_gmail_20180607_2145');
      const markers = [
        'استيقظت ذلك اليوم فى الصباح المبكر',
        'استيقظت ذلك اليوم في الصباح المبكر',
        'استيقظت ذلك اليوم',
      ];
      const start = markers.map((m) => plainText.indexOf(m)).find((i) => i >= 0);
      if (start == null || start < 0) throw new Error('الشريدة start not found');
      const endMarkers = ['خيانة فى رسائل', 'خيانة في رسائل', 'خيانة'];
      let end = plainText.length;
      for (const m of endMarkers) {
        const idx = plainText.indexOf(m, start + 500);
        if (idx > start && idx < end) end = idx;
      }
      const text = plainText.slice(start, end).trim();
      const words = assertArabic(text, 'الشريدة');
      return { plainText: text, sourceUrl, words };
    },
  },
  {
    title: 'رجال في الشمس',
    author: 'غسان كنفاني',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'رواية عن ثلاثة فلسطينيين يسعون إلى الكويت.',
    resolve: () =>
      fromArchive('20220115_20220115_1244', {
        trimMarkers: ['رجال في الشمس', 'أبو قيس', 'عابر'],
      }),
  },
  {
    title: 'عائد إلى حيفا',
    author: 'غسان كنفاني',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة سعيد وصفية العائدين إلى حيفا.',
    resolve: () =>
      fromArchive('elshandawily14386', {
        trimMarkers: ['عائد إلى حيفا', 'سعيد', 'صفية'],
      }),
  },
  {
    title: 'أم سعد',
    author: 'غسان كنفاني',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة أم سعد وفداء ابنها.',
    resolve: () =>
      fromArchive('8san_20170', {
        trimMarkers: ['أم سعد', 'الإهداء', 'الشعب والمدرسة'],
      }),
  },
  {
    title: 'موت سرير رقم 12',
    author: 'غسان كنفاني',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'قصة جريح فلسطيني في المستشفى.',
    resolve: () =>
      fromArchive('Heliopolis1957_gmail_12_201806', {
        trimMarkers: ['موت سرير', 'سرير رقم'],
      }),
  },
  {
    title: 'أرض البرتقال الحزين',
    author: 'غسان كنفاني',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: 'مجموعة قصصية عن فلسطين والمنفى.',
    resolve: () =>
      fromArchive('dodylonging_gmail_20161208_1036', {
        trimMarkers: ['أرض البرتقال', 'البرتقال الحزين'],
      }),
  },
];

async function api(path, { method = 'GET', token, body } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 400) };
  }
  if (!res.ok) {
    const msg = json.message ?? json.error ?? text.slice(0, 300);
    throw new Error(`${method} ${path} → ${res.status}: ${msg}`);
  }
  return json;
}

async function login() {
  const out = await api('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (!out.accessToken) throw new Error('Login succeeded but no accessToken returned');
  return out.accessToken;
}

async function ensureArabicEnabled(token) {
  try {
    await api('/admin/languages', { method: 'POST', token, body: { code: 'ar' } });
    console.log('Enabled language: ar');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already|enabled|exists/i.test(msg)) {
      console.log('Language ar already enabled');
    } else {
      throw err;
    }
  }
}

async function existingTitles(token) {
  const rows = await api('/admin/content/curriculum?type=all', { token });
  return new Set(rows.map((r) => r.title.trim().toLowerCase()));
}

async function importOne(token, item) {
  console.log(`\n── ${item.title}`);
  const { plainText, sourceUrl, words } = await item.resolve();
  console.log(`   fetched locally: ${words} words`);

  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      contentType: item.contentType,
      language: 'ar',
      plainText,
    },
  });
  console.log(
    `   preview: ${preview.chapterCount} chapters, ${preview.pageCount} pages, ${preview.wordCount} words`,
  );
  if (preview.wordCount < 400) {
    throw new Error(`Too few words (${preview.wordCount}) after ingest`);
  }

  const created = await api('/admin/content', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      description: item.description,
      genre: item.genre,
      language: 'ar',
      cefrLevel: item.cefrLevel,
      contentType: item.contentType,
      isFree: true,
      priceUsd: 0,
      contentSource: 'public_domain',
      sourceUrl,
      chapters: preview.chaptersPayload,
    },
  });

  console.log(`   ✓ draft id=${created.id} (${preview.wordCount} words, not published)`);
  return created.id;
}

async function main() {
  console.log(`Importing ${CATALOG.length} Arabic titles → ${API} (draft only)`);
  const token = await login();
  console.log('Logged in as admin.');
  await ensureArabicEnabled(token);

  const have = await existingTitles(token);
  let ok = 0;
  let skipped = 0;
  const failed = [];

  for (const item of CATALOG) {
    if (have.has(item.title.trim().toLowerCase())) {
      console.log(`\n── ${item.title}\n   skip (already in library)`);
      skipped += 1;
      continue;
    }
    try {
      await importOne(token, item);
      ok += 1;
    } catch (err) {
      console.error(`   ✗ ${err instanceof Error ? err.message : err}`);
      failed.push({ title: item.title, error: err instanceof Error ? err.message : String(err) });
    }
  }

  console.log(`\nDone: ${ok} imported, ${skipped} skipped, ${failed.length} failed`);
  if (failed.length) {
    console.log('Failures:');
    for (const f of failed) console.log(`  - ${f.title}: ${f.error}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
