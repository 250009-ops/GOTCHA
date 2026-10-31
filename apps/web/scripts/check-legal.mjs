#!/usr/bin/env node
// web-launch-02 guard: fails if an HTML comment or a lawyer/owner note marker reaches the legal
// sources, the generated legal HTML or the built bundle. Run after `vite build` (npm run check:legal).
// --publish also fails on unfilled placeholders ([EFFECTIVE DATE], [CLAIM PERIOD], [TTS RETENTION …]).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const publish = process.argv.includes('--publish');
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

const files = [...walk('legal-src'), 'src/lib/legalHtml.generated.ts', ...walk('dist')].filter((f) => /\.(js|html|md|ts)$/.test(f));
const problems = [];
if (/^(1|true|yes)$/i.test(String(process.env.VITE_LEGAL_V2 ?? '').trim())) problems.push('VITE_LEGAL_V2 is set: the legal QA path is retired and must not be set for any build (QA LP2-04)');
for (const f of ['legal-src', 'src/lib/legalHtml.generated.ts', 'src/pages/LegalV2Page.tsx']) if (existsSync(f)) problems.push(`${f}: retired wl01 legal draft is back`);
for (const f of files) {
  if (!existsSync(f)) continue;
  let text = readFileSync(f, 'utf8');
  if (f === 'src/lib/legalHtml.generated.ts') text = text.split('\n').filter((l) => !l.startsWith('//')).join('\n');
  // dist/index.html: only legal text matters; vite emits no comments, so scan it whole.
  for (const m of MARKERS) {
    // The bundle legitimately contains '-->' in no place we ship; '<!--' never.
    if (f.startsWith('dist') && (m === 'TODO' || m === '-->')) continue; // third-party libs may say TODO; legal text is checked via the generated source
    if (text.includes(m)) problems.push(`${f}: contains ${JSON.stringify(m)}`);
  }
  if (f.startsWith('dist')) for (const m of DRAFT_MARKERS) if (text.includes(m)) problems.push(`${f}: contains draft marker ${JSON.stringify(m)}`);
  if (publish) for (const p of PLACEHOLDERS) if (text.includes(p)) problems.push(`${f}: unfilled placeholder ${p}`);
}
if (problems.length) {
  console.error('check-legal FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-legal OK (${files.length} files${publish ? ', publish mode' : ''})`);
