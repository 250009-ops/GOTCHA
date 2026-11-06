import { useEffect, useState } from 'react';

/**
 * Telegram Mini App bridge (https://core.telegram.org/bots/webapps).
 * The SDK script is injected by index.html only when the page is opened inside Telegram,
 * so every helper here is a no-op on the normal website.
 */

type TgButton = {
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  isVisible?: boolean;
};

export type TgWebApp = {
  initData: string;
  initDataUnsafe: { user?: { id: number; first_name?: string; last_name?: string; language_code?: string }; start_param?: string };
  colorScheme: 'light' | 'dark';
  version: string;
  platform: string;
  ready: () => void;
  expand: () => void;
  close: () => void;
  isVersionAtLeast?: (v: string) => boolean;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  setBottomBarColor?: (c: string) => void;
  disableVerticalSwipes?: () => void;
  requestContact?: (cb?: (shared: boolean) => void) => void;
  openTelegramLink?: (url: string) => void;
  openLink?: (url: string) => void;
  BackButton?: TgButton;
  HapticFeedback?: {
    selectionChanged: () => void;
    impactOccurred: (s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (t: 'error' | 'success' | 'warning') => void;
  };
  onEvent?: (e: string, cb: () => void) => void;
  offEvent?: (e: string, cb: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TgWebApp };
  }
}

/** Set once the app was opened from Telegram; survives reloads inside the same webview session. */
const MODE_KEY = 'gotcha.tg';

export function getWebApp(): TgWebApp | null {
  if (typeof window === 'undefined') return null;
  const w = window.Telegram?.WebApp;
  return w && typeof w.initData === 'string' ? w : null;
}

export function tgInitData(): string {
  return getWebApp()?.initData ?? '';
}

/** True inside the Telegram Mini App (fresh launch or a reload in the same webview). */
export function isTelegramMode(): boolean {
  if (typeof window === 'undefined') return false;
  if (tgInitData()) return true;
  try {
    return sessionStorage.getItem(MODE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markTelegramMode() {
  try {
    sessionStorage.setItem(MODE_KEY, '1');
  } catch {
    /* private mode — initData still marks the session */
  }
}

/** Resolves when the SDK has loaded (or after `timeoutMs` with whatever is there). */
export function waitForWebApp(timeoutMs = 3000): Promise<TgWebApp | null> {
  return new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      const w = getWebApp();
      if (w || Date.now() - start > timeoutMs) return resolve(w);
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

let themeBound = false;

/** True when the Mini App follows Telegram's dark theme. */
export function isTelegramDark(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-tg-dark');
}

/** Paint the Telegram chrome + toggle html[data-tg-dark] (styles/telegram-dark.css) from Telegram's colour scheme. */
/**
 * Telegram dark theme is switched off for now: some pages still have light-only colours.
 * Flip to true once telegram-dark.css covers every page (the CSS, reader and live switching are ready).
 */
const TG_DARK_ENABLED = false;

function applyTheme(w: TgWebApp) {
  const dark = TG_DARK_ENABLED && w.colorScheme === 'dark';
  const root = document.documentElement;
  if (dark) root.setAttribute('data-tg-dark', '');
  else root.removeAttribute('data-tg-dark');
  try {
    // Brand header: on Android the status-bar icons stay white, so a white header hid them (clock, battery).
    w.setHeaderColor?.(dark ? '#17212b' : '#2107AA');
    w.setBackgroundColor?.(dark ? '#0e1621' : '#f6f7fb');
    w.setBottomBarColor?.(dark ? '#0e1621' : '#f6f7fb');
  } catch {
    /* older clients ignore unsupported calls */
  }
  window.dispatchEvent(new Event('gotcha:tg-theme'));
}

/** One-time setup for the Telegram chrome; the app follows Telegram's light/dark theme live. */
export function setupWebApp(w: TgWebApp) {
  try {
    w.ready();
    w.expand();
    w.disableVerticalSwipes?.();
  } catch {
    /* older clients ignore unsupported calls */
  }
  document.documentElement.dataset.tg = '1';
  applyTheme(w);
  if (!themeBound && w.onEvent) {
    themeBound = true;
    w.onEvent('themeChanged', () => applyTheme(w));
  }
}

/** startapp deep link → in-app route (sent by the bot, see services/api telegram copy). */
export function startParamRoute(param: string | undefined | null): string {
  const p = (param ?? '').trim();
  if (p.startsWith('book_')) return `/app/read/${encodeURIComponent(p.slice(5))}`;
  if (p === 'mashq') return '/app/practice';
  if (p.startsWith('chat_')) return `/app/messages?c=${encodeURIComponent(p.slice(5))}`;
  if (p === 'read') return '/app?continue=1';
  return '/app';
}

export function haptic(kind: 'select' | 'success' | 'error' | 'light') {
  const h = getWebApp()?.HapticFeedback;
  if (!h) return;
  try {
    if (kind === 'select') h.selectionChanged();
    else if (kind === 'light') h.impactOccurred('light');
    else h.notificationOccurred(kind);
  } catch {
    /* ignore */
  }
}

export function openTelegramLink(url: string) {
  const w = getWebApp();
  if (w?.openTelegramLink) w.openTelegramLink(url);
  else window.open(url, '_blank', 'noopener');
}

export const TELEGRAM_BOT_USERNAME = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined) || 'gotchaa_app_bot';
export const telegramBotLink = (start?: string) =>
  `https://t.me/${TELEGRAM_BOT_USERNAME}${start ? `?start=${encodeURIComponent(start)}` : ''}`;

/** Re-renders when Telegram switches between light and dark. */
export function useTelegramDark(): boolean {
  const [dark, setDark] = useState(isTelegramDark);
  useEffect(() => {
    const on = () => setDark(isTelegramDark());
    window.addEventListener('gotcha:tg-theme', on);
    return () => window.removeEventListener('gotcha:tg-theme', on);
  }, []);
  return dark;
}
