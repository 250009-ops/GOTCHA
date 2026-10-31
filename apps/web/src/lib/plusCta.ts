import { registerUrl, type UiLocale } from './links.ts';

/** VITE_PLUS_CHECKOUT_LIVE (default false). Prices always show; the CTA switches. */
export function plusCta(
  copy: { plusCta: string; plusNote: string; plusCta_prelaunch: string; plusNote_prelaunch: string },
  checkoutLive: boolean,
  ui: UiLocale,
) {
  if (checkoutLive) {
    return { label: copy.plusCta, note: copy.plusNote, href: registerUrl({ plan: 'free', from: 'landing-plus', ui }), live: true };
  }
  return { label: copy.plusCta_prelaunch, note: copy.plusNote_prelaunch, href: registerUrl({ plan: 'free', from: 'landing', ui }), live: false };
}
