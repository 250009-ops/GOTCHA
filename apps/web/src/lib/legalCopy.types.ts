export type LegalBullet = { label: string; body: string };

export type LegalSection = {
  id: string;
  number: string;
  title: string;
  tocLabel?: string;
  paragraphs?: string[];
  bulletsIntro?: string;
  bullets?: LegalBullet[];
  closing?: string;
  highlight?: string;
};

export type LegalDocument = {
  seoTitle: string;
  seoDescription: string;
  pageTitle: string;
  lastUpdatedLabel: string;
  lastUpdated: string;
  intro?: string;
  tocTitle: string;
  sections: LegalSection[];
  dataControllerLabel?: string;
  dataController?: string;
  privacyContactLabel?: string;
  privacyContact?: string;
};

export type LegalCopyBundle = {
  terms: LegalDocument;
  privacy: LegalDocument;
};
