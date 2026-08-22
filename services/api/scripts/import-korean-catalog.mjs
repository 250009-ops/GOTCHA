/**
 * Bulk-import the curated Korean curriculum into the admin Content Library.
 * Fetches text locally and sends plainText to ingest-preview.
 * Leaves items as draft (no publish) — upload covers and publish manually.
 *
 * Usage:
 *   node services/api/scripts/import-korean-catalog.mjs
 */
const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'GotchaAdmin2026!';
const UA =
  'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

function countWords(text) {
  return (text.match(/[\p{L}\p{M}']+/gu) ?? []).length;
}

function hangulStats(text) {
  const hangul = (text.match(/[\uAC00-\uD7A3]/g) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return { hangul, latin, words: countWords(text) };
}

function assertHangul(text, label) {
  const s = hangulStats(text);
  if (s.words < 400) throw new Error(`${label}: too few words (${s.words})`);
  if (s.hangul <= s.latin) {
    throw new Error(`${label}: expected Hangul-heavy text (h=${s.hangul}, latin=${s.latin})`);
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

function cleanLines(text, skipRe) {
  return text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      return !skipRe.test(t);
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripWiki(html) {
  const m = html.match(/<div[^>]+class="[^"]*mw-parser-output[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<!--|$)/i);
  let body = m?.[1] ?? html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ?? html;
  body = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<table[\s\S]*?<\/table>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#[0-9]+;/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const skip =
    /^(←|→|목차|주 메뉴|본문으로|위키백과|위키데이터|자매 프로젝트|출전:|저자:|🙝|🙟|나무위키|분류:|같이 보기)/;
  return cleanLines(body, skip);
}

function stripBlog(html) {
  const body =
    html.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<div[^>]+class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ??
    html.split(/<body[^>]*>/i)[1]?.split(/<\/body>/i)[0] ??
    html;
  let text = body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const skip =
    /^(728x90|반응형|공유하기|카테고리|태그|방명록|홈 |About|Today|Yesterday|Total|관련글|티스토리|열공|국어문학|삼성 문학|목차 )/i;
  text = cleanLines(text, skip);
  return text;
}

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  return res.text();
}

async function fetchWiki(url, { trimMarkers } = {}) {
  const html = await fetchHtml(url);
  let text = stripWiki(html);
  if (trimMarkers?.length) text = trimFromMarkers(text, trimMarkers);
  const words = assertHangul(text, url);
  return { plainText: text, words, sourceUrl: url };
}

async function fetchBlog(url, { trimMarkers } = {}) {
  const html = await fetchHtml(url);
  let text = stripBlog(html);
  if (trimMarkers?.length) text = trimFromMarkers(text, trimMarkers);
  const words = assertHangul(text, url);
  return { plainText: text, words, sourceUrl: url };
}

/** @type {Array<{ title: string; author: string; contentType: 'book' | 'story'; cefrLevel: string; genre: string; description: string; resolve: () => Promise<{ plainText: string; sourceUrl: string; words: number }> }>} */
const CATALOG = [
  {
    title: '운수 좋은 날',
    author: '현진건',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '일제강점기 서민의 하루를 그린 단편.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EC%9A%B4%EC%88%98_%EC%A2%8B%EC%9D%80_%EB%82%A0', {
        trimMarkers: ['새침하게'],
      }),
  },
  {
    title: '동백꽃',
    author: '김유정',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '시골 정취와 순박한 사랑 이야기.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EB%8F%99%EB%B0%B1%EA%BD%83', {
        trimMarkers: ['오늘도 또', '동백꽃'],
      }),
  },
  {
    title: '봄·봄',
    author: '김유정',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '봄날의 설렘과 향수를 담은 단편.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EB%B4%84%EB%B4%84', {
        trimMarkers: ['봄날', '봄·봄', '봄봄'],
      }),
  },
  {
    title: '메밀꽃 필 무렵',
    author: '이효석',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '서울에서 고향으로 향하는 1인칭 회상 소설.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EB%A9%94%EB%B0%80%EA%BD%83_%ED%95%84_%EB%AC%B4%EB%A0%B5', {
        trimMarkers: ['여름밤', '메밀', '모밀'],
      }),
  },
  {
    title: '소나기',
    author: '황순원',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '소녀와 소년의 잔잔한 만남.',
    resolve: () =>
      fetchBlog('https://cjwan1104.tistory.com/13240493', {
        trimMarkers: ['소년', '소녀', '소나기'],
      }),
  },
  {
    title: '날개',
    author: '이상',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '식민지 지식인의 정신적 갈등을 그린 소설.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EB%82%A0%EA%B0%9C', {
        trimMarkers: ['〈조광〉', '날개'],
      }),
  },
  {
    title: '수난이대',
    author: '하근찬',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '6·25 전쟁과 가족의 기다림.',
    resolve: () =>
      fetchBlog('https://rains2005.tistory.com/738', {
        trimMarkers: ['박만도', '수난이대', '진수'],
      }),
  },
  {
    title: '화사집/B사감과 러브레터',
    author: '현진건',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '현진건의 풍자 단편 B사감과 러브레터.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/B%EC%82%AC%EA%B0%90%EA%B3%BC_%EB%9F%AC%EB%B8%8C%EB%A0%88%ED%84%B0', {
        trimMarkers: ['C여학교', 'B사감'],
      }),
  },
  {
    title: '사랑손님과 어머니',
    author: '주요섭',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '전쟁 통에 헤어진 가족의 이야기.',
    resolve: () =>
      fetchBlog('https://gguddi-gguddi.tistory.com/47', {
        trimMarkers: ['나는 금년', '박옥희', '사랑 손님'],
      }),
  },
  {
    title: '감자',
    author: '김동인',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '욕망과 파멸을 그린 단편.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EA%B0%90%EC%9E%90', {
        trimMarkers: ['싸움', '감자'],
      }),
  },
  {
    title: '배따라기',
    author: '김동인',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '농촌의 비극적 삶.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EB%B0%B0%EB%94%B0%EB%9D%BC%EA%B8%B0', {
        trimMarkers: ['좋은 일기', '배따라기'],
      }),
  },
  {
    title: '광염 소나타',
    author: '김동인',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '예술가의 열정과 파멸.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EA%B4%91%EC%97%BC_%EC%86%8C%EB%82%98%ED%83%80', {
        trimMarkers: ['광염', '소나타'],
      }),
  },
  {
    title: '발가락이 닮았다',
    author: '김동인',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '욕망과 신분 갈등.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EB%B0%9C%EA%B0%80%EB%9D%BD%EC%9D%B4_%EB%8B%AE%EC%95%98%EB%8B%A4', {
        trimMarkers: ['그는', '발가락이'],
      }),
  },
  {
    title: '레디메이드 인생',
    author: '채만식',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '근대 도시민의 삶과 풍자.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EB%A0%88%EB%94%94%EB%A9%94%EC%9D%B4%EB%93%9C_%EC%9D%B8%EC%83%9D', {
        trimMarkers: ['레디메이드'],
      }),
  },
  {
    title: '치숙',
    author: '채만식',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '식민지 시대 가부장제 풍자.',
    resolve: () =>
      fetchWiki('https://ko.wikisource.org/wiki/%EC%B9%98%EC%88%99', {
        trimMarkers: ['우리 아저씨', '치숙'],
      }),
  },
  {
    title: '태평천하 (절반 분권판)',
    author: '채만식',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '지주 윤직원의 풍자 소설 (전반부).',
    resolve: async () => {
      const url =
        'https://wheregongbu.tistory.com/entry/%EC%B1%84%EB%A7%8C%EC%8B%9D-%ED%83%9C%ED%8F%89%EC%B2%9C%ED%95%98-%EC%A0%84%EB%AC%B8-%EB%B0%8F-%ED%95%B4%EC%84%9D';
      const { text, sourceUrl } = await fetchBlog(url, {
        trimMarkers: ['추석을 지나', '윤직원', '태평천하'],
      });
      const plainText = halfVolume(text);
      const words = assertHangul(plainText, '태평천하 half');
      return { plainText, sourceUrl, words };
    },
  },
  {
    title: '탁류 (발췌본)',
    author: '채만식',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '군산 미두장을 배경으로 한 장편 (발췌).',
    resolve: async () => {
      const url =
        'https://seelotus.tistory.com/entry/%ED%83%81%EB%A5%98-%EC%A0%84%EB%AC%B8-%EC%B1%84%EB%A7%8C%EC%8B%9D';
      const { text, sourceUrl } = await fetchBlog(url, {
        trimMarkers: ['탁류', '정주사', '미두장', '초봉'],
      });
      const plainText = excerptWords(text, 9000);
      const words = assertHangul(plainText, '탁류 excerpt');
      return { plainText, sourceUrl, words };
    },
  },
  {
    title: '만세전',
    author: '염상섭',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '식민지 지식인의 좌절과 풍자.',
    resolve: () =>
      fetchBlog(
        'https://wheregongbu.tistory.com/entry/%EC%97%BC%EC%83%81%EC%84%AD-%EB%A7%8C%EC%84%B8%EC%A0%84%E8%90%AC%E6%AD%B2%E5%89%8D-%EC%A0%84%EB%AC%B8',
        { trimMarkers: ['만세전', '만세 전'] },
      ),
  },
  {
    title: '표구된 휴지',
    author: '이범선',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    description: '표구된 창호지 편지에 담긴 따뜻한 인간미.',
    resolve: () =>
      fetchBlog('https://handaikhan.tistory.com/285', {
        trimMarkers: ['누렇게', '표구된 휴지'],
      }),
  },
  {
    title: '삼포 가는 길',
    author: '황석영',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    description: '떠돌이 세 사람의 겨울길과 상실.',
    resolve: () =>
      fetchBlog('https://dalmot.tistory.com/7863644', {
        trimMarkers: ['삼포', '영달', '누군가'],
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

async function ensureKoreanEnabled(token) {
  try {
    await api('/admin/languages', { method: 'POST', token, body: { code: 'ko' } });
    console.log('Enabled language: ko');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/already|enabled|exists/i.test(msg)) {
      console.log('Language ko already enabled');
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
      language: 'ko',
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
      language: 'ko',
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
  console.log(`Importing ${CATALOG.length} Korean titles → ${API} (draft only, no publish)`);
  const token = await login();
  console.log('Logged in as admin.');
  await ensureKoreanEnabled(token);

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
