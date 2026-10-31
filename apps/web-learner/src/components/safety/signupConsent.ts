/**
 * S3 sign-up tick-box. Labels are VERBATIM from team/pm/legal/web/README.md ("Sign-up tick-box labels",
 * 31 Oct 14:06) and must match the API's CONSENT_LABELS (services/api/src/common/safety/consent.ts).
 * Do not edit the wording here; change the README first, then bump CONSENT_VERSION on the API.
 */
export type ConsentLocale = 'uz' | 'ru' | 'en';

export const CONSENT_LABELS: Record<ConsentLocale, string> = {
  uz: 'Foydalanish shartlari, Maxfiylik siyosati va Ommaviy oferta bilan tanishdim va ularni qabul qilaman, jumladan AI funksiyalari uchun matn (masalan, soʻz va u turgan gap yoki men tarjima qilgan chat xabarlari) AQShdagi OpenAIʼga uzatilishiga roziman.',
  ru: 'Я прочитал(а) и принимаю Условия использования, Политику конфиденциальности и Публичную оферту, включая передачу текста для AI-функций (например, слова с его предложением или переводимых мной сообщений чата) в OpenAI (США).',
  en: 'I have read and accept the Terms of Use, the Privacy Policy and the Public Offer, including the transfer of text for AI features (such as a word with its sentence, or chat messages I translate) to OpenAI in the USA.',
};

/** The substrings of each label that become links (no wording change). Version web-2026-10-31.2. */
export const CONSENT_LINK_PHRASES: Record<ConsentLocale, { terms: string; privacy: string; oferta: string }> = {
  uz: { terms: 'Foydalanish shartlari', privacy: 'Maxfiylik siyosati', oferta: 'Ommaviy oferta' },
  ru: { terms: 'Условия использования', privacy: 'Политику конфиденциальности', oferta: 'Публичную оферту' },
  en: { terms: 'Terms of Use', privacy: 'Privacy Policy', oferta: 'Public Offer' },
};

export type ConsentLink = 'terms' | 'privacy' | 'oferta';
export type Part = { text: string; link?: ConsentLink };

export function consentParts(locale: ConsentLocale): Part[] {
  const label = CONSENT_LABELS[locale];
  const phrases = CONSENT_LINK_PHRASES[locale];
  const hits = (Object.keys(phrases) as ConsentLink[])
    .map((k) => ({ k, i: label.indexOf(phrases[k]) }))
    .sort((a, b) => a.i - b.i);
  if (hits.some((h) => h.i < 0)) return [{ text: label }];
  const out: Part[] = [];
  let pos = 0;
  for (const h of hits) {
    out.push({ text: label.slice(pos, h.i) }, { text: phrases[h.k], link: h.k });
    pos = h.i + phrases[h.k].length;
  }
  out.push({ text: label.slice(pos) });
  return out.filter((p) => p.text);
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
