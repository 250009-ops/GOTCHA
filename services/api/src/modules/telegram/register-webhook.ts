/**
 * Registers the bot webhook and the chat menu button.
 * Called on API boot when the public URL is known, and from deploy/update.sh.
 * Does not print the token.
 */
export async function registerTelegramWebhook(env: NodeJS.ProcessEnv = process.env): Promise<'registered' | 'skipped'> {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const secret = env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (!token || !secret) return 'skipped';
  const explicit = env.TELEGRAM_WEBHOOK_URL?.trim();
  const domain = env.DOMAIN?.trim();
  const url = explicit || (domain ? `https://${domain}/api/v1/telegram/webhook` : '');
  if (!url || /localhost|127\.0\.0\.1/.test(url)) return 'skipped';
  const mini = (env.TELEGRAM_MINI_APP_URL || (domain ? `https://${domain}/tg` : 'https://gotchaa.uz/tg')).replace(/\/$/, '');
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
  const menu = await fetch(`https://api.telegram.org/bot${token}/setChatMenuButton`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      menu_button: { type: 'web_app', text: 'Ochish', web_app: { url: mini } },
    }),
  });
  if (!hook.ok || !menu.ok) return 'skipped';
  return 'registered';
}
