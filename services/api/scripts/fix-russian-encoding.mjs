/**
 * Re-ingest az.lib.ru titles with correct UTF-8 text — preserves cover images.
 *
 * Usage:
 *   node services/api/scripts/fix-russian-encoding.mjs
 */
const API = (process.env.API_URL ?? 'https://gotchaa.uz/api/v1').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'admin@gotcha.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/** Titles imported from az.lib.ru that may have mojibake in production. */
const FIX_TARGETS = [
  {
    id: '05e878aa-161a-4086-966d-762c955fbe66',
    title: 'Шинель',
    contentType: 'story',
    sourceUrl: 'http://az.lib.ru/g/gogolx_n_w/text_0120.shtml',
  },
  {
    id: 'd847c7c6-13b3-434e-873b-bd07966d6c52',
    title: 'Нос',
    contentType: 'story',
    sourceUrl: 'http://az.lib.ru/g/gogolx_n_w/text_0110.shtml',
  },
  {
    id: 'c5aedbfd-c4b6-4f06-af2a-dac6fbf79782',
    title: 'Первая любовь',
    contentType: 'book',
    sourceUrl: 'http://az.lib.ru/t/turgenew_i_s/text_0120.shtml',
  },
  {
    id: 'd1e293b5-9180-433e-9d3c-3f013c4892ee',
    title: 'Палата № 6',
    contentType: 'book',
    sourceUrl: 'http://az.lib.ru/c/chehow_a_p/text_1892_palata.shtml',
  },
];

const EXTRA_LANGUAGES = ['tr', 'de', 'ko'];

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
  // Drop lib.ru site chrome (nav, registration links, footer).
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
  // Trim lib.ru header block before the actual story body.
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

function hasCyrillic(text) {
  return /[\u0400-\u04FF]/.test(text);
}

function looksMojibake(text) {
  return /[ÃÐÑÒÓÔÕÖØÙÚÛÜÝÞßà-ÿ]{6,}/.test(text) && !hasCyrillic(text);
}

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

async function enableLanguages(token) {
  for (const code of EXTRA_LANGUAGES) {
    try {
      await api('/admin/languages', { method: 'POST', token, body: { code } });
      console.log(`   ✓ enabled language: ${code}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/already|enabled|exists/i.test(msg)) {
        console.log(`   · language ${code} already enabled`);
      } else {
        console.warn(`   ! could not enable ${code}: ${msg}`);
      }
    }
  }
}

async function fixOne(token, item) {
  console.log(`\n── ${item.title} (${item.id})`);

  const before = await api(`/admin/content/${item.id}/reader/page?from=0`, { token });
  const sample = String(before.text ?? before.plainText ?? '').slice(0, 200);
  console.log(`   before: ${sample.slice(0, 80).replace(/\s+/g, ' ')}…`);

  if (
    hasCyrillic(sample) &&
    !looksMojibake(sample) &&
    !/Lib\.ru|\[ ?Обсуждения ?\]|Комментарии:/i.test(sample)
  ) {
    console.log('   skip (already correct Cyrillic)');
    return { id: item.id, status: 'ok' };
  }

  const plainText = await fetchAzLibPlainText(item.sourceUrl);
  const words = (plainText.match(/[\p{L}\p{M}']+/gu) ?? []).length;
  if (!hasCyrillic(plainText.slice(0, 500))) {
    throw new Error('Fetched text still lacks Cyrillic — source decode failed');
  }
  console.log(`   fetched ${words} words (Cyrillic OK)`);

  const preview = await api('/admin/content/ingest-preview', {
    method: 'POST',
    token,
    body: {
      title: item.title,
      contentType: item.contentType,
      language: 'ru',
      plainText,
    },
  });

  const result = await api(`/admin/content/${item.id}/reingest`, {
    method: 'PATCH',
    token,
    body: {
      title: item.title,
      contentType: item.contentType,
      language: 'ru',
      chapters: preview.chaptersPayload,
    },
  });

  const after = await api(`/admin/content/${item.id}/reader/page?from=0`, { token });
  const afterSample = String(after.text ?? after.plainText ?? '').slice(0, 200);
  if (!hasCyrillic(afterSample)) {
    throw new Error(`Still not Cyrillic after reingest: ${afterSample.slice(0, 60)}`);
  }

  console.log(
    `   ✓ reingested (${preview.wordCount} words, cover=${result.coverImageKey ? 'kept' : 'none'})`,
  );
  console.log(`   after: ${afterSample.slice(0, 80).replace(/\s+/g, ' ')}…`);
  return { id: item.id, status: 'fixed', coverImageKey: result.coverImageKey };
}

async function main() {
  console.log(`Fix Russian encoding → ${API}`);
  const token = await login();
  console.log('Logged in as admin.');

  console.log('\nEnabling Turkish, German, Korean in language catalog…');
  await enableLanguages(token);

  const results = [];
  for (const item of FIX_TARGETS) {
    try {
      results.push(await fixOne(token, item));
    } catch (err) {
      console.error(`   ✗ ${err instanceof Error ? err.message : err}`);
      results.push({ id: item.id, status: 'failed', error: err instanceof Error ? err.message : String(err) });
    }
  }

  const fixed = results.filter((r) => r.status === 'fixed').length;
  const ok = results.filter((r) => r.status === 'ok').length;
  const failed = results.filter((r) => r.status === 'failed');
  console.log(`\nDone: ${fixed} fixed, ${ok} already OK, ${failed.length} failed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
