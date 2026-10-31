/**
 * S3 sign-up consent. One tick-box, unticked by default, covering the Terms, the Privacy Policy, the Public Offer (oferta) and the
 * ZRU-547 art. 15 transfer of AI text to OpenAI (Kai/owner 13:08). Labels are VERBATIM from
 * team/pm/legal/web/README.md ("Sign-up tick-box labels", 31 Oct 14:06). Bump CONSENT_VERSION whenever
 * the label text or the Terms/Privacy version changes; the version, time and IP are stored on the user.
 */
export const CONSENT_VERSION = 'web-2026-10-31.2';

export const CONSENT_LABELS = {
  uz: 'Foydalanish shartlari, Maxfiylik siyosati va Ommaviy oferta bilan tanishdim va ularni qabul qilaman, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap yoki men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman.',
  ru: 'Я прочитал(а) и принимаю Условия использования, Политику конфиденциальности и Публичную оферту, включая передачу текста для AI-функций (например, слова с его предложением или переводимых мной сообщений чата) в OpenAI (США).',
  en: 'I have read and accept the Terms of Use, the Privacy Policy and the Public Offer, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA.',
} as const;

/** Web sign-ups must tick the box. Android is frozen and its live build cannot send it (flagged to Kai). */
export function consentRequired(clientPlatform?: string | null): boolean {
  return clientPlatform !== 'android';
}
