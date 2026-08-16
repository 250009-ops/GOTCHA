/** Open the learner's real inbox — never a blank mailto: compose window. */

const WEBMAIL: Record<string, (email: string) => string> = {
  'gmail.com': (email) =>
    `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#search/gotcha`,
  'googlemail.com': (email) =>
    `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}#search/gotcha`,
  'outlook.com': () => 'https://outlook.live.com/mail/0/inbox',
  'hotmail.com': () => 'https://outlook.live.com/mail/0/inbox',
  'live.com': () => 'https://outlook.live.com/mail/0/inbox',
  'msn.com': () => 'https://outlook.live.com/mail/0/inbox',
  'yahoo.com': () => 'https://mail.yahoo.com',
  'ymail.com': () => 'https://mail.yahoo.com',
  'icloud.com': () => 'https://www.icloud.com/mail',
  'me.com': () => 'https://www.icloud.com/mail',
  'mac.com': () => 'https://www.icloud.com/mail',
  'proton.me': () => 'https://mail.proton.me',
  'protonmail.com': () => 'https://mail.proton.me',
  'mail.ru': () => 'https://e.mail.ru/inbox',
  'yandex.ru': () => 'https://mail.yandex.com',
  'yandex.com': () => 'https://mail.yandex.com',
  'bk.ru': () => 'https://e.mail.ru/inbox',
  'list.ru': () => 'https://e.mail.ru/inbox',
  'inbox.ru': () => 'https://e.mail.ru/inbox',
};

export function emailInboxUrl(email?: string | null): string | null {
  const trimmed = email?.trim();
  if (!trimmed || !trimmed.includes('@')) return null;
  const domain = trimmed.split('@').pop()?.toLowerCase() ?? '';
  const build = WEBMAIL[domain];
  return build ? build(trimmed) : null;
}

export function openEmailInbox(email?: string | null): boolean {
  const url = emailInboxUrl(email);
  if (url) {
    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.assign(url);
    }
    return true;
  }

  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (mobile) {
    // System mail app (inbox), not a compose sheet.
    window.location.href = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      ? 'message://'
      : 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.APP_EMAIL;end';
    return true;
  }

  return false;
}
