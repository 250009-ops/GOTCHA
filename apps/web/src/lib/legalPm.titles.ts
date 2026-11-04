import type { MarketingLocale } from './webLocale';

// Short titles (browser tab, footer, SEO). EN must equal the sign-up tick-box label wording ("Terms of Use").
// uz uses U+02BB (oʻ/gʻ) where needed; neither title happens to contain one, but no ASCII ' is allowed.
export const LEGAL_TITLES: Record<'terms' | 'privacy' | 'oferta', Record<MarketingLocale, string>> = {
  terms: { en: 'Terms of Use', ru: 'Условия использования', uz: 'Foydalanish shartlari' },
  privacy: { en: 'Privacy Policy', ru: 'Политика конфиденциальности', uz: 'Maxfiylik siyosati' },
  oferta: { en: 'Public Offer', ru: 'Публичная оферта', uz: 'Ommaviy oferta' },
};

