/**
 * S3 sign-up tick-box. Labels are VERBATIM from team/pm/legal/web/README.md ("Sign-up tick-box labels",
 * 31 Oct 13:22) and must match the API's CONSENT_LABELS (services/api/src/common/safety/consent.ts).
 * Do not edit the wording here; change the README first, then bump CONSENT_VERSION on the API.
 */
export type ConsentLocale = 'uz' | 'ru' | 'en';

export const CONSENT_LABELS: Record<ConsentLocale, string> = {
  uz: 'Foydalanish shartlari va Maxfiylik siyosatiga, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap, men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman (18 yoshga toʻlmagan boʻlsam, buni ota-onam yoki vasiyim tasdiqlaydi).',
  ru: 'Я принимаю Условия использования и Политику конфиденциальности, включая передачу текста для AI-функций (например, слова с его предложением и переводимых мной сообщений чата) в OpenAI (США) (если мне нет 18 лет, это подтверждает мой родитель или опекун).',
  en: 'I agree to the Terms of Use and the Privacy Policy, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA (if I am under 18, my parent or guardian confirms this).',
};

/** The substrings of each label that become links (no wording change). */
export const CONSENT_LINK_PHRASES: Record<ConsentLocale, { terms: string; privacy: string }> = {
  uz: { terms: 'Foydalanish shartlari', privacy: 'Maxfiylik siyosati' },
  ru: { terms: 'Условия использования', privacy: 'Политику конфиденциальности' },
  en: { terms: 'Terms of Use', privacy: 'Privacy Policy' },
};

export type Part = { text: string; link?: 'terms' | 'privacy' };

export function consentParts(locale: ConsentLocale): Part[] {
  const label = CONSENT_LABELS[locale];
  const { terms, privacy } = CONSENT_LINK_PHRASES[locale];
  const ti = label.indexOf(terms);
  const pi = label.indexOf(privacy);
  if (ti < 0 || pi < 0 || pi < ti) return [{ text: label }];
  return [
    { text: label.slice(0, ti) },
    { text: terms, link: 'terms' },
    { text: label.slice(ti + terms.length, pi) },
    { text: privacy, link: 'privacy' },
    { text: label.slice(pi + privacy.length) },
  ].filter((p) => p.text) as Part[];
}

export function toConsentLocale(l: string | undefined): ConsentLocale {
  return l === 'ru' || l === 'en' ? l : 'uz';
}

export const AGE_COPY: Record<ConsentLocale, { label: string; preferNot: string; promptTitle: string; promptBody: string; save: string; skip: string }> = {
  uz: {
    label: 'Tugʻilgan yilingiz (ixtiyoriy)',
    preferNot: 'Aytmaslikni afzal koʻraman',
    promptTitle: 'Tugʻilgan yilingiz',
    promptBody: 'Bu yoshingizga mos sozlamalarni tanlashimizga yordam beradi. Faqat bir marta soʻraymiz.',
    save: 'Saqlash',
    skip: 'Aytmaslikni afzal koʻraman',
  },
  ru: {
    label: 'Год рождения (необязательно)',
    preferNot: 'Предпочитаю не указывать',
    promptTitle: 'Ваш год рождения',
    promptBody: 'Это поможет нам выбрать подходящие для вашего возраста настройки. Мы спросим только один раз.',
    save: 'Сохранить',
    skip: 'Предпочитаю не указывать',
  },
  en: {
    label: 'Birth year (optional)',
    preferNot: 'Prefer not to say',
    promptTitle: 'Your birth year',
    promptBody: 'This helps us pick settings that suit your age. We only ask once.',
    save: 'Save',
    skip: 'Prefer not to say',
  },
};

export function birthYearOptions(now = new Date()): number[] {
  const y = now.getFullYear();
  const out: number[] = [];
  for (let v = y; v >= y - 100; v--) out.push(v);
  return out;
}
