/**
 * One-off: publish docs/telegram-bot/bot-profile.json to @gotchaa_app.
 * Reads TELEGRAM_BOT_TOKEN from the environment or deploy/.env. Never prints the token.
 *
 *   npx ts-node --transpile-only deploy/telegram-bot-profile.ts
 */
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';

const root = resolve(dirname(__filename), '..');

function loadEnvFile(file: string) {
  let text = '';
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(root, 'deploy/.env'));

const token = process.env.TELEGRAM_BOT_TOKEN?.trim() ?? '';
if (!token) {
  console.error('TELEGRAM_BOT_TOKEN is missing');
  process.exit(1);
}

interface LocaleProfile {
  name: string;
  short: string;
  desc: string;
  cmd: string;
}

const profile = JSON.parse(readFileSync(resolve(root, 'docs/telegram-bot/bot-profile.json'), 'utf8')) as Record<string, LocaleProfile>;

function redact(value: string): string {
  return value.split(token).join('[redacted]');
}

function assertLength(label: string, value: string, max: number) {
  const length = [...value].length;
  if (length > max) throw new Error(`${label} is ${length} characters (max ${max})`);
}

async function call(method: string, body: Record<string, unknown>) {
  let response: Response;
  try {
    response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(`${method} failed: network`);
  }
  const data = (await response.json().catch(() => null)) as { ok?: boolean; description?: string; result?: { username?: string } } | null;
  if (!data?.ok) {
    throw new Error(`${method} failed: ${redact(data?.description || `HTTP ${response.status}`)}`);
  }
  return data;
}

async function main() {
  for (const [locale, row] of Object.entries(profile)) {
    assertLength(`${locale} name`, row.name, 64);
    assertLength(`${locale} short`, row.short, 120);
    assertLength(`${locale} description`, row.desc, 512);
    assertLength(`${locale} command`, row.cmd, 256);
  }

  const me = await call('getMe', {});
  const username = me.result?.username ?? '';
  if (username !== 'gotchaa_app') {
    console.error(`Refusing to update @${username || 'unknown'}; this script only updates @gotchaa_app`);
    process.exit(1);
  }
  console.log('Updating @gotchaa_app');

  const uz = profile.uz;
  const name = 'Gotcha';
  if (profile.uz.name !== name || profile.ru.name !== name || profile.en.name !== name) {
    throw new Error('bot-profile.json name must be Gotcha for uz, ru and en');
  }
  await call('setMyName', { name });
  for (const language_code of ['uz', 'ru', 'en']) await call('setMyName', { name, language_code });
  await call('setMyDescription', { description: uz.desc });
  await call('setMyShortDescription', { short_description: uz.short });
  await call('setMyCommands', { commands: [{ command: 'start', description: uz.cmd }] });
  for (const language_code of ['ru', 'en'] as const) {
    const row = profile[language_code];
    await call('setMyDescription', { description: row.desc, language_code });
    await call('setMyShortDescription', { short_description: row.short, language_code });
    await call('setMyCommands', { commands: [{ command: 'start', description: row.cmd }], language_code });
  }
  console.log('Bot profile updated.');

  const names = [];
  for (const language_code of [undefined, 'uz', 'ru', 'en'] as const) {
    const body = language_code ? { language_code } : {};
    const got = await call('getMyName', body);
    names.push({ language_code: language_code ?? 'default', name: (got.result as { name?: string } | undefined)?.name ?? '' });
  }
  const descriptions = [];
  for (const language_code of [undefined, 'ru', 'en'] as const) {
    const body = language_code ? { language_code } : {};
    const got = await call('getMyDescription', body);
    const short = await call('getMyShortDescription', body);
    descriptions.push({
      language_code: language_code ?? 'default',
      description: (got.result as { description?: string } | undefined)?.description ?? '',
      short: (short.result as { short_description?: string } | undefined)?.short_description ?? '',
    });
  }
  console.log(JSON.stringify({ names, descriptions }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'bot profile update failed';
  console.error(redact(message));
  process.exit(1);
});
