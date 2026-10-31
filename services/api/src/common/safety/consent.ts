/**
 * S3 sign-up consent. One tick-box, unticked by default, covering the Terms, the Privacy Policy and the
 * ZRU-547 art. 15 transfer of AI text to OpenAI (Kai/owner 13:08). Labels are VERBATIM the PM's pre-oferta
 * copy (31 Oct 15:24: no Public Offer link until the oferta is published; was web-2026-10-31.2). Bump CONSENT_VERSION whenever
 * the label text or the Terms/Privacy version changes; the version, time and IP are stored on the user.
 */
export const CONSENT_VERSION = 'web-2026-10-31.3';

export const CONSENT_LABELS = {
  uz: 'Foydalanish shartlari va Maxfiylik siyosati bilan tanishdim va ularni qabul qilaman, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap yoki men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman.',
  ru: 'Я прочитал(а) и принимаю Условия использования и Политику конфиденциальности, включая передачу текста для AI-функций (например, слова с его предложением или переводимых мной сообщений чата) в OpenAI в США.',
  en: 'I have read and accept the Terms of Use and the Privacy Policy, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA.',
} as const;

/**
 * Web sign-ups must tick the box. Android is frozen and its live build cannot send it (flagged to Kai), so a native
 * request may skip it. WL4-03: a browser always sends Origin on the cross-origin POST, so any request with an Origin
 * (or a web Referer) needs consent even if it claims clientPlatform 'android'.
 */
export function consentRequired(clientPlatform?: string | null, browserOrigin?: string | null): boolean {
  if (browserOrigin && browserOrigin.trim() && browserOrigin.trim() !== 'null') return true;
  return clientPlatform !== 'android';
}
