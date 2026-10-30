/** Learner-facing promo code strings (paywalls). */
export type PromoCopy = { label: string; placeholder: string; apply: string; remove: string; applied: (code: string) => string; discount: string };
export const PROMO_COPY: Record<'en' | 'ru' | 'uz', PromoCopy> = {
  en: { label: 'Promo code', placeholder: 'Enter code', apply: 'Apply', remove: 'Remove', applied: (code: string) => `${code} applied`, discount: 'Discount' },
  ru: { label: 'Промокод', placeholder: 'Введите код', apply: 'Применить', remove: 'Убрать', applied: (code: string) => `Промокод ${code} применён`, discount: 'Скидка' },
  uz: { label: 'Promokod', placeholder: 'Kodni kiriting', apply: 'Qoʻllash', remove: 'Olib tashlash', applied: (code: string) => `${code} qoʻllandi`, discount: 'Chegirma' },
};
export function promoCopyFor(lang: string | null | undefined): PromoCopy {
  return PROMO_COPY[lang === 'ru' || lang === 'uz' ? lang : 'en'];
}
