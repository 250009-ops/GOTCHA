// Copies the canonical logo (BRAND-logo.md) + design tokens into every app so they can never drift.
// Run after changing anything in packages/shared/brand or packages/shared/styles:  node packages/shared/brand/sync.mjs
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const A = join(here, 'assets');
const root = join(here, '..', '..', '..');
const brandSvgs = [
  'gotcha-mark.svg', 'gotcha-mark-elevated.svg', 'gotcha-mark-mono-white.svg',
  'gotcha-wordmark-light.svg', 'gotcha-wordmark-dark.svg',
  'gotcha-lockup-light.svg', 'gotcha-lockup-dark.svg',
];
const pub = {
  'favicon.svg': 'gotcha-mark.svg',
  'favicon-16.png': 'png/favicon-16.png', 'favicon-32.png': 'png/favicon-32.png', 'favicon-192.png': 'png/favicon-192.png',
  'favicon-512.png': 'png/favicon-512.png', 'icon-maskable-512.png': 'png/icon-maskable-512.png',
  'apple-touch-icon.png': 'png/apple-touch-icon-180.png', 'favicon.ico': 'png/favicon.ico',
};
for (const app of ['web-learner', 'admin', 'web']) {
  const p = join(root, 'apps', app, 'public');
  mkdirSync(join(p, 'brand'), { recursive: true });
  for (const f of brandSvgs) copyFileSync(join(A, f), join(p, 'brand', f));
  for (const [to, from] of Object.entries(pub)) copyFileSync(join(A, from), join(p, to));
  copyFileSync(join(here, 'GotchaLogo.tsx'), join(root, 'apps', app, 'src', 'components', 'GotchaLogo.tsx'));
}
const tokenDest = { 'web-learner': 'src/styles/gotcha-tokens.css', admin: 'src/gotcha-tokens.css', web: 'src/gotcha-tokens.css' };
for (const [app, rel] of Object.entries(tokenDest)) {
  copyFileSync(join(here, '..', 'styles', 'gotcha-tokens.css'), join(root, 'apps', app, rel));
}
const res = join(root, 'apps', 'android', 'app', 'src', 'main', 'res', 'drawable');
for (const f of ['ic_gotcha_mark.xml', 'ic_gotcha_wordmark.xml', 'ic_launcher_foreground.xml', 'ic_launcher_monochrome.xml']) copyFileSync(join(here, 'android', f), join(res, f));
console.log('logo + tokens synced');
