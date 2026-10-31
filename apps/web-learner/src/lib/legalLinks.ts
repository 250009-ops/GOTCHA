/**
 * Legal links from the learner app into the marketing site (apps/web, wl01). Every path here must be a real route
 * in apps/web/src/App.tsx; tests/legal-links.test.mjs and the bundle gate tools/check-legal-links.mjs enforce it.
 *
 * QA S2 (31 Oct): /oferta was retired in wl01 51f9154 (canonical oferta in team/pm/legal/web still has
 * [EFFECTIVE DATE] / [OFERTA URL], which the publish guard blocks). Until PM publishes it, "Public Offer" opens
 * the live Terms page. When an /oferta route ships in apps/web, point `oferta` back at it.
 */
export const WEB_LEGAL_ROUTES = ['/terms', '/privacy'] as const;
export type WebLegalRoute = (typeof WEB_LEGAL_ROUTES)[number];

export const CONSENT_LINK_PATHS: Record<'terms' | 'privacy' | 'oferta', WebLegalRoute> = {
  terms: '/terms',
  privacy: '/privacy',
  oferta: '/terms',
};
