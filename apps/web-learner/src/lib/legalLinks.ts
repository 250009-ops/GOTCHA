/**
 * Legal links from the learner app into the marketing site (apps/web, wl01). Every path here must be a real route
 * in apps/web/src/App.tsx; tests/legal-links.test.mjs and the bundle gate tools/check-legal-links.mjs enforce it.
 *
 * payments-02 (G1): the sign-up consent (CONSENT_VERSION web-2026-10-31.4) links Terms of Use, Privacy Policy and the
 * Public Offer. /oferta (and /terms) render team/pm/legal/web/pending-payments-02 in apps/web on payments-02-wlive.
 * RELEASE: the marketing site that ships must have the /oferta route (wl01 e3ce3f9 retired it).
 */
export const WEB_LEGAL_ROUTES = ['/terms', '/privacy', '/oferta'] as const;
export type WebLegalRoute = (typeof WEB_LEGAL_ROUTES)[number];

export const CONSENT_LINK_PATHS: Record<'terms' | 'privacy' | 'oferta', WebLegalRoute> = {
  terms: '/terms',
  privacy: '/privacy',
  oferta: '/oferta',
};
