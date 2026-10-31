/**
 * Legal links from the learner app into the marketing site (apps/web, wl01). Every path here must be a real route
 * in apps/web/src/App.tsx; tests/legal-links.test.mjs and the bundle gate tools/check-legal-links.mjs enforce it.
 *
 * PM 31 Oct 15:24: the sign-up consent is the pre-oferta version (CONSENT_VERSION web-2026-10-31.3) and links only
 * Terms of Use and Privacy Policy. There is no Public Offer link until the oferta is published with its own route.
 */
export const WEB_LEGAL_ROUTES = ['/terms', '/privacy'] as const;
export type WebLegalRoute = (typeof WEB_LEGAL_ROUTES)[number];

export const CONSENT_LINK_PATHS: Record<'terms' | 'privacy', WebLegalRoute> = {
  terms: '/terms',
  privacy: '/privacy',
};
