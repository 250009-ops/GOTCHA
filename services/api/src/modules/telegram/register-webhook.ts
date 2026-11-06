/**
 * Registers the bot webhook. The chat menu button is set only when
 * TELEGRAM_MENU_BUTTON_ENABLED is true (off until the mini app exists).
 * Called on API boot when the public URL is known, and from deploy/update.sh.
 * Does not print the token.
 */
export function telegramMenuButtonEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return ['1', 'true', 'yes', 'on'].includes(String(env.TELEGRAM_MENU_BUTTON_ENABLED ?? '').trim().toLowerCase());
}

export async function registerTelegramWebhook(env: NodeJS.ProcessEnv = process.env): Promise<'registered' | 'skipped'> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!token || !secret) return 'skipped';
  const explicit = env.TELEGRAM_WEBHOOK_URL?.trim();
  const domain = env.DOMAIN?.trim();
  const url = explicit || (domain ? `https://${domain}/api/v1/telegram/webhook` : '');
  if (!url || /localhost|127\.0\.0\.1/.test(url)) return 'skipped';
  const mini = (env.TELEGRAM_MINI_APP_URL || (domain ? `https://${domain}/learn/tg` : 'https://gotchaa.uz/learn/tg')).replace(/\/$/, '');
  const hook = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: false,
    }),
  });
  if (!hook.ok) return 'skipped';
  if (!telegramMenuButtonEnabled(env)) return 'registered';
  const menu = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      menu_button: { type: 'web_app', text: 'Ochish', web_app: { url: mini } },
    }),
  });
  if (!menu.ok) return 'skipped';
  return 'registered';
}
