import { plusUrl, type UiLocale } from './links.ts';

/** WLF-34 (Kai 19:36): Plus is on sale, so the landing CTA is always the buy CTA to the learner Plus page (/learn/app/plus). */
export function plusCta(copy: { plusCta: string; plusNote: string }, ui: UiLocale) {
  return { label: copy.plusCta, note: copy.plusNote, href: plusUrl({ ui }), live: true };
}
