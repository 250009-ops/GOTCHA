// landing-premium-02: a production (deploy) build must not ship legal pages with an unfilled [EFFECTIVE DATE].
// The QA build (VITE_LEGAL_V2=true) is allowed: it shows the red "QA DRAFT · NOT FOR DEPLOY" banner.
// Visible draft markers in PM's oferta text (uz/ru/en) block a production build too.
export const PUBLISH_PLACEHOLDERS = ['[EFFECTIVE DATE]', 'NOT PUBLISHED', 'НЕ ОПУБЛИКОВАН', 'EʼLON QILINMAGAN'];
export function legalPublishProblems({ mode, qaBuild, legalSource }) {
  if (mode !== 'production' || qaBuild) return [];
  // Any [ALLCAPS] legal placeholder ([EFFECTIVE DATE], [OFERTA URL], …), same pattern as PM's build_html.py.
  const found = new Set([...PUBLISH_PLACEHOLDERS.filter((p) => legalSource.includes(p)), ...(legalSource.match(/\[[A-Z][A-Z /]+\]/g) ?? [])]);
  return [...found].map(
    (p) => `legal pages still contain ${p}; fill it in team/pm/legal/web and re-run scripts/gen_legal.py, or build the QA preview with VITE_LEGAL_V2=true`,
  );
}

// UI/UX 14:32: the footer build stamp must never ship. A production (deploy) build with VITE_PREVIEW_STAMP=true fails.
export function previewStampProblems({ mode, qaBuild, previewStamp }) {
  return mode === 'production' && !qaBuild && previewStamp === 'true'
    ? ['VITE_PREVIEW_STAMP=true is set on a production build; the build stamp is for QA previews (VITE_LEGAL_V2=true) only']
    : [];
}
