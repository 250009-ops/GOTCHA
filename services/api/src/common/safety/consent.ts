/**
 * S3 sign-up consent. One tick-box, unticked by default, covering the Terms, the Privacy Policy and the
 * ZRU-547 art. 15 transfer of AI text to OpenAI (Kai/owner 13:08). payments-02 (G1): labels are VERBATIM the
 * PENDING lines of team/pm/legal/web/README.md 'Sign-up tick-box labels' (Terms, Privacy and Public Offer; was .3 pre-oferta). Bump CONSENT_VERSION whenever
 * the label text or the Terms/Privacy version changes; the version, time and IP are stored on the user.
 */
export const CONSENT_VERSION = 'web-2026-10-31.4';

/** PAY2-17: the pre-oferta label (Terms + Privacy only) that the shipped gotcha-fix learner (53bffd3) shows and never names. */
export const CONSENT_VERSION_PRE_OFERTA = 'web-2026-10-31.3';
/** Versions whose labels a shipped client can display. Anything else is refused, never recorded. */
export const KNOWN_CONSENT_VERSIONS: readonly string[] = [CONSENT_VERSION_PRE_OFERTA, CONSENT_VERSION];

/**
 * PAY2-17: record the version the client actually DISPLAYED, never the server's newest. A client that sends no
 * consentVersion is the shipped pre-oferta learner, so it is recorded as .3 (Terms + Privacy), not .4. Returns null
 * for an unknown version (caller answers 400). Existing users are never re-prompted; the Public Offer itself is
 * accepted per purchase at checkout (acceptOferta, import_payments.oferta_version).
 */
export function recordedConsentVersion(clientVersion?: string | null): string | null {
  const v = (clientVersion ?? '').trim();
  if (!v) return CONSENT_VERSION_PRE_OFERTA;
  return KNOWN_CONSENT_VERSIONS.includes(v) ? v : null;
}

export const CONSENT_LABELS = {
  uz: 'Foydalanish shartlari, Maxfiylik siyosati va Ommaviy oferta bilan tanishdim va ularni qabul qilaman, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap yoki men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman.',
  ru: 'Я прочитал(а) и принимаю Условия использования, Политику конфиденциальности и Публичную оферту, включая передачу текста для AI-функций (например, слова с его предложением или переводимых мной сообщений чата) в OpenAI (США).',
  en: 'I have read and accept the Terms of Use, the Privacy Policy and the Public Offer, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA.',
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
