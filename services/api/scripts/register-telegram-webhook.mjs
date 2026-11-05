/**
 * Deploy hook: register the Telegram webhook.
 * The "Ochish" menu button is set only when TELEGRAM_MENU_BUTTON_ENABLED=true.
 * Reads the runtime .env. Never prints the bot token.
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2];
  }
}

const root = process.env.VPS_APP_DIR || process.cwd();
loadEnv(resolve(root, '.env'));
loadEnv(resolve(root, 'services/api/.env'));

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
if (!token || !secret) {
  console.log('telegram webhook skipped');
  process.exit(0);
}
const domain = process.env.DOMAIN?.trim();
const url = process.env.TELEGRAM_WEBHOOK_URL?.trim() || (domain ? `https://${domain}/api/v1/telegram/webhook` : '');
const mini = (process.env.TELEGRAM_MINI_APP_URL || (domain ? `https://${domain}/tg` : 'https://gotchaa.uz/tg')).replace(/\/$/, '');
if (!url) {
  console.log('telegram webhook skipped');
  process.exit(0);
}

const post = (method, body) => fetch(`https://api.telegram.org/bot${token}/${method}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const hook = await post('setWebhook', {
  url,
  secret_token: secret,
  allowed_updates: ['message', 'callback_query'],
  drop_pending_updates: false,
});
if (!hook.ok) {
  console.log('telegram webhook skipped');
  process.exit(0);
}
const menuOn = ['1', 'true', 'yes', 'on'].includes(String(process.env.TELEGRAM_MENU_BUTTON_ENABLED ?? '').trim().toLowerCase());
if (menuOn) {
  const menu = await post('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Ochish', web_app: { url: mini } },
  });
  if (!menu.ok) {
    console.log('telegram webhook skipped');
    process.exit(0);
  }
}
console.log('telegram webhook registered');
