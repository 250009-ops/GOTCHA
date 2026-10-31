/**
 * Bulk-import the curated Russian curriculum into the admin Content Library.
 * Uses ingest-preview + create + publish (no covers).
 *
 * Usage:
 *   node services/api/scripts/import-russian-catalog.mjs
 */
const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '<REDACTED-admin-pw>';

async function fetchAzLibPlainText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'GotchaImporter/2.1 (+https://gotcha.app) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    },
  });
  if (!res.ok) throw new Error(`Could not download ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const html = new TextDecoder('windows-1251').decode(buf);
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
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  const metaLine =
    /^(Комментарии:|Год:|Обновлено:|Статистика|Повесть\s*:|Скачать FB2|Ваша оценка:|шедевр|замечательно|очень хорошо|хорошо|нормально|Не читал|терпимо|посредственно|плохо|очень плохо|не читать|\d+k\.)/i;
  text = text
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (metaLine.test(t)) return false;
      if (/^Lib\.ru/i.test(t)) return false;
      if (/\[ ?Регистрация ?\]|\[ ?Найти ?\]|\[ ?Рейтинги ?\]/i.test(t)) return false;
      if (/\[ ?Обсуждения ?\]|\[ ?Новинки ?\]|\[ ?Обзоры ?\]|\[ ?Помощь ?\]/i.test(t)) return false;
      if ((t.match(/\[[^\]]+\]/g) ?? []).length >= 3) return false;
      if (/^E-mail:/i.test(t)) return false;
      if (/^© /i.test(t)) return false;
      return true;
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  for (const marker of [
    'Посвящено',
    'Гости давно',
    'В департаменте',
    'Нигде не останавливалось',
    'Часть I',
    'ЧАСТЬ I',
    'Глава I',
  ]) {
    const idx = text.indexOf(marker);
    if (idx > 80 && idx < text.length * 0.35) {
      const head = text.slice(0, idx).trim();
      const lines = head.split('\n').filter(Boolean);
      const keep = lines.slice(-2).join('\n');
      text = `${keep}\n\n${text.slice(idx).trim()}`.trim();
      break;
    }
  }
  return text;
}

/** @type {Array<{ title: string; author: string; contentType: 'book' | 'story'; cefrLevel: string; genre: string; sourceUrl: string; description: string }>} */
const CATALOG = [
  {
    title: 'Пиковая дама',
    author: 'Александр Пушкин',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%9F%D0%B8%D0%BA%D0%BE%D0%B2%D0%B0%D1%8F_%D0%B4%D0%B0%D0%BC%D0%B0_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)',
    description: 'История Германна, одержимого тайной трёх выигрышных карт.',
  },
  {
    title: 'Шинель',
    author: 'Николай Гоголь',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl: 'http://az.lib.ru/g/gogolx_n_w/text_0120.shtml',
    description: 'Судьба скромного чиновника Акакия Акакиевича и его новой шинели.',
  },
  {
    title: 'Белые ночи',
    author: 'Фёдор Достоевский',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%91%D0%B5%D0%BB%D1%8B%D0%B5_%D0%BD%D0%BE%D1%87%D0%B8_(%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9)',
    description: 'Мечтатель и незнакомка встречаются в белые ночи Петербурга.',
  },
  {
    title: 'Каштанка',
    author: 'Антон Чехов',
    contentType: 'story',
    cefrLevel: 'b1',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%9A%D0%B0%D1%88%D1%82%D0%B0%D0%BD%D0%BA%D0%B0_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)',
    description: 'Собака Каштанка попадает в цирк и долго не может выбрать, где ей дом.',
  },
  {
    title: 'Смерть Ивана Ильича',
    author: 'Лев Толстой',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%A1%D0%BC%D0%B5%D1%80%D1%82%D1%8C_%D0%98%D0%B2%D0%B0%D0%BD%D0%B0_%D0%98%D0%BB%D1%8C%D0%B8%D1%87%D0%B0_(%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9)',
    description: 'Чиновник сталкивается с болезнью и вынужден переосмыслить прожитую жизнь.',
  },
  {
    title: 'Нос',
    author: 'Николай Гоголь',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'satire',
    sourceUrl: 'http://az.lib.ru/g/gogolx_n_w/text_0110.shtml',
    description: 'У колlegiate assessor Ковалёва внезапно пропадает нос — и появляется сам по себе.',
  },
  {
    title: 'Дама с собачкой',
    author: 'Антон Чехов',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%94%D0%B0%D0%BC%D0%B0_%D1%81_%D1%81%D0%BE%D0%B1%D0%B0%D1%87%D0%BA%D0%BE%D0%B9_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)',
    description: 'Случайная ялтинская встреча превращается в любовь, которой нельзя жить открыто.',
  },
  {
    title: 'Первая любовь',
    author: 'Иван Тургенев',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl: 'http://az.lib.ru/t/turgenew_i_s/text_0120.shtml',
    description: 'Взрослый мужчина вспоминает лето шестнадцати, когда впервые полюбил.',
  },
  {
    title: 'Человек в футляре',
    author: 'Антон Чехов',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%A7%D0%B5%D0%BB%D0%BE%D0%B2%D0%B5%D0%BA_%D0%B2_%D1%84%D1%83%D1%82%D0%BB%D1%8F%D1%80%D0%B5_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)',
    description: 'Учитель Беликов живёт в страхе перед жизнью — пока не появляется Ковалёва.',
  },
  {
    title: 'Сон смешного человека',
    author: 'Фёдор Достоевский',
    contentType: 'story',
    cefrLevel: 'c1',
    genre: 'philosophical',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%A1%D0%BE%D0%BD_%D1%81%D0%BC%D0%B5%D1%88%D0%BD%D0%BE%D0%B3%D0%BE_%D1%87%D0%B5%D0%BB%D0%BE%D0%B2%D0%B5%D0%BA%D0%B0_(%D0%94%D0%BE%D1%81%D1%82%D0%BE%D0%B5%D0%B2%D1%81%D0%BA%D0%B8%D0%B9)',
    description: 'Человек, решившийся покончить с собой, видит сон о другой, более сострадательной жизни.',
  },
  {
    title: 'Палата № 6',
    author: 'Антон Чехов',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'classic',
    sourceUrl: 'http://az.lib.ru/c/chehow_a_p/text_1892_palata.shtml',
    description: 'Доктор Рагин начинает разговаривать с пациентом палаты № 6 — и теряет покой.',
  },
  {
    title: 'Станционный смотритель',
    author: 'Александр Пушкин',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%A1%D1%82%D0%B0%D0%BD%D1%86%D0%B8%D0%BE%D0%BD%D0%BD%D1%8B%D0%B9_%D1%81%D0%BC%D0%BE%D1%82%D1%80%D0%B8%D1%82%D0%B5%D0%BB%D1%8C_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)',
    description: 'Путешественник узнаёт трагическую историю старого смотрителя и его дочери Дуни.',
  },
  {
    title: 'Выстрел',
    author: 'Александр Пушкин',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%92%D1%8B%D1%81%D1%82%D1%80%D0%B5%D0%BB_(%D0%9F%D1%83%D1%88%D0%BA%D0%B8%D0%BD)',
    description: 'В казармах гусар рассказывает историю дуэли, которая не закончилась выстрелом.',
  },
  {
    title: 'Муму',
    author: 'Иван Тургенев',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%9C%D1%83%D0%BC%D1%83_(%D0%A2%D1%83%D1%80%D0%B3%D0%B5%D0%BD%D0%B5%D0%B2)',
    description: 'Глухой дворник Герасим и его собака Муму — история безжалостной власти.',
  },
  {
    title: 'Портрет',
    author: 'Николай Гоголь',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'gothic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%9F%D0%BE%D1%80%D1%82%D1%80%D0%B5%D1%82_(%D0%93%D0%BE%D0%B3%D0%BE%D0%BB%D1%8C)',
    description: 'Художник покупает портрет, который обещает богатство — и разрушает душу.',
  },
  {
    title: 'Леди Макбет Мценского уезда',
    author: 'Николай Лесков',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%9B%D0%B5%D0%B4%D0%B8_%D0%9C%D0%B0%D0%BA%D0%B1%D0%B5%D1%82_%D0%9C%D1%86%D0%B5%D0%BD%D1%81%D0%BA%D0%BE%D0%B3%D0%BE_%D1%83%D0%B5%D0%B7%D0%B4%D0%B0_(%D0%9B%D0%B5%D1%81%D0%BA%D0%BE%D0%B2)',
    description: 'Катерина Измайлова вырывается из смерти в жизнь — любой ценой.',
  },
  {
    title: 'Хозяин и работник',
    author: 'Лев Толстой',
    contentType: 'story',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%A5%D0%BE%D0%B7%D1%8F%D0%B8%D0%BD_%D0%B8_%D1%80%D0%B0%D0%B1%D0%BE%D1%82%D0%BD%D0%B8%D0%BA_(%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9)',
    description: 'Барин и крестьянин заблудились в метели — и между ними меняется многое.',
  },
  {
    title: 'Крейцерова соната',
    author: 'Лев Толстой',
    contentType: 'book',
    cefrLevel: 'c1',
    genre: 'philosophical',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%9A%D1%80%D0%B5%D0%B9%D1%86%D0%B5%D1%80%D0%BE%D0%B2%D0%B0_%D1%81%D0%BE%D0%BD%D0%B0%D1%82%D0%B0_(%D0%A2%D0%BE%D0%BB%D1%81%D1%82%D0%BE%D0%B9)',
    description: 'Пассажир рассказывает историю ревности, музыки и убийства в поезде.',
  },
  {
    title: 'Ася',
    author: 'Иван Тургенев',
    contentType: 'book',
    cefrLevel: 'b2',
    genre: 'classic',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%90%D1%81%D1%8F_(%D0%A2%D1%83%D1%80%D0%B3%D0%B5%D0%BD%D0%B5%D0%B2)',
    description: 'Лето на Рейне, странная девушка Ася и любовь, которую легко упустить.',
  },
  {
    title: 'Чёрный монах',
    author: 'Антон Чехов',
    contentType: 'story',
    cefrLevel: 'c1',
    genre: 'psychological',
    sourceUrl:
      'https://ru.wikisource.org/wiki/%D0%A7%D1%91%D1%80%D0%BD%D1%8B%D0%B9_%D0%BC%D0%BE%D0%BD%D0%B0%D1%85_(%D0%A7%D0%B5%D1%85%D0%BE%D0%B2)',
    description: 'Учёный Коврин видит чёрного монаха — и его жизнь ускоряется.',
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

async function existingTitles(token) {
  const rows = await api('/admin/content/curriculum?type=all', { token });
  return new Set(rows.map((r) => r.title.trim().toLowerCase()));
}

async function importOne(token, item) {
  console.log(`\n── ${item.title}`);
  let plainText;
  if (/az\.lib\.ru/i.test(item.sourceUrl)) {
    plainText = await fetchAzLibPlainText(item.sourceUrl);
    const words = (plainText.match(/[\p{L}\p{M}']+/gu) ?? []).length;
    console.log(`   az.lib.ru: ${words} words fetched locally`);
  }

  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      contentType: item.contentType,
      language: 'ru',
      ...(plainText ? { plainText } : { sourceUrl: item.sourceUrl }),
    },
  });
  console.log(
    `   preview: ${preview.chapterCount} chapters, ${preview.pageCount} pages, ${preview.wordCount} words`,
  );
  if (preview.wordCount < 500) {
    throw new Error(`Too few words (${preview.wordCount}) — source may be blocked or truncated`);
  }

  const created = await api('/admin/content', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      author: item.author,
      description: item.description,
      genre: item.genre,
      language: 'ru',
      cefrLevel: item.cefrLevel,
      contentType: item.contentType,
      isFree: true,
      priceUsd: 0,
      contentSource: 'public_domain',
      sourceUrl: item.sourceUrl,
      chapters: preview.chaptersPayload,
    },
  });

  await api(`/admin/content/${created.id}/publish`, { method: 'PATCH', token });
  console.log(`   ✓ published id=${created.id} (${preview.wordCount} words, no cover)`);
  return created.id;
}

async function main() {
  console.log(`Importing ${CATALOG.length} Russian titles → ${API}`);
  const token = await login();
  console.log('Logged in as admin.');

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
