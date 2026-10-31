#!/usr/bin/env node
// web-launch-02 guard: fails if an HTML comment or a lawyer/owner note marker reaches the legal
// sources, the generated legal HTML or the built bundle. Run after `vite build` (npm run check:legal).
// --publish also fails on unfilled placeholders ([EFFECTIVE DATE], [CLAIM PERIOD], [TTS RETENTION …]).
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const publish = process.argv.includes('--publish');
const MARKERS = ['<!--', '-->', 'TODO', 'FIXME', 'LAWYER', 'lawyer review', 'TODO(lawyer', 'TODO(owner', 'TODO(eng', 'TODO(pm', 'TODO(devops'];
// The oferta's visible 'DRAFT, NOT PUBLISHED' line is PM legal text (not a note); scripts/legal-guard.mjs blocks it in a production build.
const PLACEHOLDERS = ['[EFFECTIVE DATE]', '[CLAIM PERIOD]', '[TTS RETENTION'];

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = [...walk('legal-src'), 'src/lib/legalHtml.generated.ts', ...walk('dist'), ...walk('dist-legal-qa')].filter((f) => /\.(js|html|md|ts)$/.test(f));
const problems = [];
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
  if (publish) for (const p of PLACEHOLDERS) if (text.includes(p)) problems.push(`${f}: unfilled placeholder ${p}`);
}
if (problems.length) {
  console.error('check-legal FAILED:\n  ' + problems.join('\n  '));
  process.exit(1);
}
console.log(`check-legal OK (${files.length} files${publish ? ', publish mode' : ''})`);
