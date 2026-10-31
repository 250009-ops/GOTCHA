// WLF-07 (final-3): /terms and /privacy render the PM's current web drafts verbatim.
// payments-02 release line (payments-02-web): /terms and the new /oferta render the PM's pending-payments-02
// files, vendored byte-for-byte in legal-pm-payments/ (npm run legal:sync-payments). /privacy is unchanged.
// legal-pm/*.html are byte-for-byte copies of team/pm/legal/web/{terms,privacy}-{en,ru,uz}.html
// (NOT pending-payments-02, NOT oferta). Refresh with `npm run legal:sync`; tests/legal-pm.test.ts
// fails if the copies drift from the PM files or the served bundle does not contain them.
import type { MarketingLocale } from './webLocale';
import termsEn from '../../legal-pm-payments/terms-en.html?raw';
import termsRu from '../../legal-pm-payments/terms-ru.html?raw';
import termsUz from '../../legal-pm-payments/terms-uz.html?raw';
import ofertaEn from '../../legal-pm-payments/oferta-en.html?raw';
import ofertaRu from '../../legal-pm-payments/oferta-ru.html?raw';
import ofertaUz from '../../legal-pm-payments/oferta-uz.html?raw';
import privacyEn from '../../legal-pm/privacy-en.html?raw';
import privacyRu from '../../legal-pm/privacy-ru.html?raw';
import privacyUz from '../../legal-pm/privacy-uz.html?raw';

export type LegalDoc = 'terms' | 'privacy' | 'oferta';

const HTML: Record<LegalDoc, Record<MarketingLocale, string>> = {
  terms: { en: termsEn, ru: termsRu, uz: termsUz },
  privacy: { en: privacyEn, ru: privacyRu, uz: privacyUz },
  oferta: { en: ofertaEn, ru: ofertaRu, uz: ofertaUz },
};

export { LEGAL_TITLES } from './legalPm.titles';

export function legalHtml(doc: LegalDoc, locale: MarketingLocale): string {
  return HTML[doc][locale] ?? HTML[doc].uz;
}
