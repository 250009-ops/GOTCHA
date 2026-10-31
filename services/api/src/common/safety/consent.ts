/**
 * S3 sign-up consent. One tick-box, unticked by default, covering the Terms, the Privacy Policy and the
 * ZRU-547 art. 15 transfer of AI text to OpenAI (Kai/owner 13:08). Labels are VERBATIM from
 * team/pm/legal/web/README.md ("Sign-up tick-box labels", 31 Oct 13:22). Bump CONSENT_VERSION whenever
 * the label text or the Terms/Privacy version changes; the version, time and IP are stored on the user.
 */
export const CONSENT_VERSION = 'web-2026-10-31.1';

export const CONSENT_LABELS = {
  uz: 'Foydalanish shartlari va Maxfiylik siyosatiga, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap, men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman (18 yoshga toʻlmagan boʻlsam, buni ota-onam yoki vasiyim tasdiqlaydi).',
  ru: 'Я принимаю Условия использования и Политику конфиденциальности, включая передачу текста для AI-функций (например, слова с его предложением и переводимых мной сообщений чата) в OpenAI (США) (если мне нет 18 лет, это подтверждает мой родитель или опекун).',
  en: 'I agree to the Terms of Use and the Privacy Policy, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA (if I am under 18, my parent or guardian confirms this).',
} as const;

/** Web sign-ups must tick the box. Android is frozen and its live build cannot send it (flagged to Kai). */
export function consentRequired(clientPlatform?: string | null): boolean {
  return clientPlatform !== 'android';
}
