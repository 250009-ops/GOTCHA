#!/usr/bin/env node
// payments-02 publish guard for the /oferta page. Always fails on HTML comments in the generated legal
// HTML. With --publish (the deploy build) it also fails while the oferta still has unfilled placeholders:
// [EFFECTIVE DATE] or [OFERTA URL], or the "NOT PUBLISHED" draft banner.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const PLACEHOLDERS = ['[EFFECTIVE DATE]', '[OFERTA URL]', 'NOT PUBLISHED'];
const walk = (d) => (existsSync(d) ? readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)])) : []);

export function checkLegal({ publish, files }) {
  const problems = [];
  for (const f of files) {
    if (!existsSync(f)) continue;
    const text = readFileSync(f, 'utf8').split('\n').filter((l) => !l.startsWith('//')).join('\n');
    if (!f.startsWith('dist') && text.includes('<!--')) problems.push(`${f}: contains an HTML comment`);
    if (publish) for (const p of PLACEHOLDERS) if (text.includes(p)) problems.push(`${f}: unfilled placeholder ${p}`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const publish = process.argv.includes('--publish');
  const files = ['src/lib/ofertaHtml.generated.ts', ...walk('dist').filter((f) => /\.(js|html)$/.test(f))];
  const problems = checkLegal({ publish, files });
  if (problems.length) { console.error('check-legal FAILED:\n  ' + problems.join('\n  ')); process.exit(1); }
  console.log(`check-legal OK (${files.length} files${publish ? ', publish mode' : ''})`);
}
