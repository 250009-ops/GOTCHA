// landing-premium-02: a production (deploy) build must not ship legal pages with an unfilled [EFFECTIVE DATE].
// The QA build (VITE_LEGAL_V2=true) is allowed: it shows the red "QA DRAFT · NOT FOR DEPLOY" banner.
// Visible draft markers in PM's oferta text (uz/ru/en) block a production build too.
export const PUBLISH_PLACEHOLDERS = ['[EFFECTIVE DATE]', 'NOT PUBLISHED', 'НЕ ОПУБЛИКОВАН', 'EʼLON QILINMAGAN'];
export function legalPublishProblems({ mode, qaBuild, legalSource }) {
  if (mode !== 'production' || qaBuild) return [];
  return PUBLISH_PLACEHOLDERS.filter((p) => legalSource.includes(p)).map(
    (p) => `legal pages still contain ${p}; fill it in team/pm/legal/web and re-run scripts/gen_legal.py, or build the QA preview with VITE_LEGAL_V2=true`,
  );
}
