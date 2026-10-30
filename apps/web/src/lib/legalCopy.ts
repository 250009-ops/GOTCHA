import type { MarketingLocale } from './webLocale';
import type { LegalCopyBundle } from './legalCopy.types';
import { LEGAL_EN } from './legalCopy.en';
import { LEGAL_RU } from './legalCopy.ru';
import { LEGAL_UZ } from './legalCopy.uz';

const COPIES: Record<MarketingLocale, LegalCopyBundle> = { en: LEGAL_EN, ru: LEGAL_RU, uz: LEGAL_UZ };

export function legalCopyFor(locale: MarketingLocale): LegalCopyBundle {
  return COPIES[locale] ?? LEGAL_UZ;
}

export type { LegalCopyBundle, LegalDocument, LegalSection, LegalBullet } from './legalCopy.types';
