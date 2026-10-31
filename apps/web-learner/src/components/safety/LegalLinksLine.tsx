import { MARKETING_URL } from '../../lib/links';
import { CONSENT_LINK_PATHS } from '../../lib/legalLinks';
import { toConsentLocale } from './signupConsent';

const L = {
  uz: { terms: 'Foydalanish shartlari', privacy: 'Maxfiylik siyosati', oferta: 'Ommaviy oferta' },
  ru: { terms: 'Условия использования', privacy: 'Политика конфиденциальности', oferta: 'Публичная оферта' },
  en: { terms: 'Terms of Use', privacy: 'Privacy Policy', oferta: 'Public Offer' },
} as const;
export const legalLinksText = (locale: string) => L[toConsentLocale(locale)];

/** WLF-36 / QA2-3: Terms, Privacy and Oferta are linked on register step 1 too (the required tick-box stays on step 2). */
export function LegalLinksLine({ locale }: { locale: string }) {
  const l = toConsentLocale(locale);
  const t = L[l];
  const a = (key: 'terms' | 'privacy' | 'oferta') => (
    <a href={`${MARKETING_URL}${CONSENT_LINK_PATHS[key]}?lang=${l}`} target="_blank" rel="noopener noreferrer" className="underline text-[#4a5565] hover:text-[#101828]">{t[key]}</a>
  );
  return (
    <p data-testid="register-legal-links" className="text-xs text-[#4a5565] text-center">
      {a('terms')} · {a('privacy')} · {a('oferta')}
    </p>
  );
}
