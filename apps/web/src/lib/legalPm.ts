// WLF-07 (final-3): /terms and /privacy render the PM's current web drafts verbatim.
// legal-pm/*.html are byte-for-byte copies of team/pm/legal/web/{terms,privacy}-{en,ru,uz}.html
// (NOT pending-payments-02, NOT oferta). Refresh with `npm run legal:sync`; tests/legal-pm.test.ts
// fails if the copies drift from the PM files or the served bundle does not contain them.
import type { MarketingLocale } from './webLocale';
import termsEn from '../../legal-pm/terms-en.html?raw';
import termsRu from '../../legal-pm/terms-ru.html?raw';
import termsUz from '../../legal-pm/terms-uz.html?raw';
import privacyEn from '../../legal-pm/privacy-en.html?raw';
import privacyRu from '../../legal-pm/privacy-ru.html?raw';
import privacyUz from '../../legal-pm/privacy-uz.html?raw';

export type LegalDoc = 'terms' | 'privacy';

const HTML: Record<LegalDoc, Record<MarketingLocale, string>> = {
  terms: { en: termsEn, ru: termsRu, uz: termsUz },
  privacy: { en: privacyEn, ru: privacyRu, uz: privacyUz },
};

export { LEGAL_TITLES } from './legalPm.titles';

export function legalHtml(doc: LegalDoc, locale: MarketingLocale): string {
  return HTML[doc][locale] ?? HTML[doc].uz;
}
