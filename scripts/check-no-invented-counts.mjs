#!/usr/bin/env node
// P3b (Kai): fail if an invented learner-count fallback reappears in web/API/Android source.
// Banned: the old FALLBACK_LEARNER_COUNT constant and the Figma mock number (12840 in any spelling).
// Usage: node scripts/check-no-invented-counts.mjs   (exit 1 on any hit)
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const SCAN = [
  'apps/web/src', 'apps/web-learner/src', 'apps/admin/src',
  'services/api/src', 'services/api/prisma', 'services/worker/src',
  'apps/android/app/src', 'apps/android/i18n',
];
const EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|kt|kts|xml|py|sql|prisma)$/;
// Built from parts so this file never matches itself.
const NUM = ['12', '840'];
const BANNED = new RegExp(['FALLBACK_' + 'LEARNER_COUNT', `\\b${NUM[0]}[,_ \\u00a0.]?${NUM[1]}\\b`].join('|'));

export function findInventedCounts(base = root) {
  const hits = [];
  const walk = (dir) => {
    let names;
    try { names = readdirSync(dir); } catch { return; }
    for (const name of names) {
      if (name === 'node_modules' || name === 'build' || name === 'dist' || name === '__pycache__') continue;
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (EXT.test(name)) {
        readFileSync(p, 'utf8').split(/\r?\n/).forEach((line, i) => {
          if (BANNED.test(line)) hits.push(`${relative(base, p)}:${i + 1}: ${line.trim().slice(0, 120)}`);
        });
      }
    }
  };
  for (const d of SCAN) walk(join(base, d));
  return hits;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const hits = findInventedCounts();
  if (hits.length) {
    console.error(`Invented learner-count fallback found (${hits.length}):\n` + hits.join('\n'));
    process.exit(1);
  }
  console.log('check-no-invented-counts: OK (0 hits)');
}
