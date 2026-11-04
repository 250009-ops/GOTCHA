#!/usr/bin/env node
// web-launch-02 guard: fails if an HTML comment or a lawyer/owner note marker reaches the legal
// sources, the generated legal HTML or the built bundle. Run after `vite build` (npm run check:legal).
// --publish also fails on unfilled placeholders ([EFFECTIVE DATE], [CLAIM PERIOD], [TTS RETENTION …]).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// PAY2-24: every build is a publish build unless it is an explicit local draft preview (LEGAL_DRAFT_PREVIEW=1), so a deploy
// path that runs the plain `npm run build` can never ship a bare [PLACEHOLDER] or a draft line.
const publish = process.argv.includes('--publish') || !/^(1|true|yes)$/i.test(String(process.env.LEGAL_DRAFT_PREVIEW ?? '').trim());
// PAY2-14 (payments-02): `npm run build:publish` (the deploy path, deploy/lib/vite-env.sh) runs this with --publish.
// --publish rejects ANY bracketed ALL-CAPS placeholder ([TBD BY PM], [EFFECTIVE DATE], [OFERTA URL] …), the PM
// "not published" lines in en/ru/uz, VITE_PREVIEW_STAMP=true and LEGAL_DRAFT_PREVIEW.
// LEGAL_DRAFT_PREVIEW=1 (local QA only, never publish) lets the plain build carry the pending payments-02 drafts
// (legal-pm-payments/) so /terms and /oferta can be reviewed; it never relaxes legal-pm/ or the comment markers.
const truthy = (v) => /^(1|true|yes)$/i.test(String(v ?? '').trim());
const draftPreview = !publish && truthy(process.env.LEGAL_DRAFT_PREVIEW);
const PLACEHOLDER_RE = /\[[A-Z][A-Z0-9 /&.,'-]*\]/g;
const UNPUBLISHED = ['NOT PUBLISHED', 'НЕ ОПУБЛИКОВАН', 'EʼLON QILINMAGAN', "E'LON QILINMAGAN"];
const MARKERS = ['<!--', '-->', 'TODO', 'FIXME', 'LAWYER', 'lawyer review', 'TODO(lawyer', 'TODO(owner', 'TODO(eng', 'TODO(pm', 'TODO(devops', 'NOT PUBLISHED'];
const PLACEHOLDERS = ['[EFFECTIVE DATE]', '[OFERTA URL]', '[CLAIM PERIOD]', '[TTS RETENTION'];
// web-launch-04 (QA LP2-04): the VITE_LEGAL_V2 QA path is retired; the flag can no longer switch any page or skip a check.
// A build run with it set fails, and so does any leftover draft banner / DRAFT line in the bundle.
const DRAFT_MARKERS = ['QA DRAFT', 'NOT FOR DEPLOY', 'DRAFT, NOT PUBLISHED', 'EʼLON QILINMAGAN', 'LEGAL_HTML_V2'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = [...walk('legal-src'), ...walk('legal-pm'), ...walk('legal-pm-payments'), 'src/lib/legalHtml.generated.ts', ...walk('dist')].filter((f) => /\.(js|html|md|ts)$/.test(f));
const problems = [];
if (/^(1|true|yes)$/i.test(String(process.env.VITE_LEGAL_V2 ?? '').trim())) problems.push('VITE_LEGAL_V2 is set: the legal QA path is retired and must not be set for any build (QA LP2-04)');
for (const f of ['legal-src', 'src/lib/legalHtml.generated.ts', 'src/pages/LegalV2Page.tsx']) if (existsSync(f)) problems.push(`${f}: retired wl01 legal draft is back`);
if (publish && truthy(process.env.VITE_PREVIEW_STAMP)) problems.push('VITE_PREVIEW_STAMP=true on a publish build: the build stamp is for previews only (PAY2-14)');
if (publish && truthy(process.env.LEGAL_DRAFT_PREVIEW)) problems.push('LEGAL_DRAFT_PREVIEW is set on a publish build (PAY2-14)');
const DRAFT_LINES = new Set(['NOT PUBLISHED', ...DRAFT_MARKERS.filter((m) => m === 'DRAFT, NOT PUBLISHED' || m === 'EʼLON QILINMAGAN')]);
for (const f of files) {
  if (!existsSync(f)) continue;
  let text = readFileSync(f, 'utf8');
  // Draft preview: the PM's draft lines may appear in the pending payments docs and in the bundle that embeds them.
  const draftOk = draftPreview && (f.startsWith('legal-pm-payments') || f.startsWith('dist'));
  if (f === 'src/lib/legalHtml.generated.ts') text = text.split('\n').filter((l) => !l.startsWith('//')).join('\n');
  // dist/index.html: only legal text matters; vite emits no comments, so scan it whole.
  for (const m of MARKERS) {
    // The bundle legitimately contains '-->' in no place we ship; '<!--' never.
    if (f.startsWith('dist') && (m === 'TODO' || m === '-->')) continue; // third-party libs may say TODO; legal text is checked via the generated source
    if (draftOk && DRAFT_LINES.has(m)) continue;
    if (text.includes(m)) problems.push(`${f}: contains ${JSON.stringify(m)}`);
  }
  if (f.startsWith('dist')) for (const m of DRAFT_MARKERS) if (!(draftOk && DRAFT_LINES.has(m)) && text.includes(m)) problems.push(`${f}: contains draft marker ${JSON.stringify(m)}`);
  if (publish) {
    const found = new Set([...PLACEHOLDERS.filter((p) => text.includes(p)), ...(text.match(PLACEHOLDER_RE) ?? []).filter((p) => !f.startsWith('dist') || isLegalPlaceholder(p))]);
    for (const p of found) problems.push(`${f}: unfilled placeholder ${p}`);
    for (const u of UNPUBLISHED) if (text.includes(u)) problems.push(`${f}: unpublished-draft line ${JSON.stringify(u)}`);
  }
}
if (problems.length) {
  console.error('check-legal FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-legal OK (${files.length} files${publish ? ', publish mode' : ''})`);

// In the minified bundle, only flag bracketed tokens that look like prose placeholders (contain a space or are
// known), so library strings like "[A]" or "[X]" don't trip it; sources are checked with the full pattern.
function isLegalPlaceholder(p) { return /\s/.test(p) || PLACEHOLDERS.some((k) => p.startsWith(k.replace(/\]$/, ''))); }
