// Writes the standalone deploy package.json for the API dist tgz (no workspace).
// @gotcha/shared is shipped inside the tgz at vendor/gotcha-shared and referenced as file:.
// Usage: node scripts/make-deploy-manifest.mjs <outDir>
import fs from 'node:fs';
import path from 'node:path';
const here = path.dirname(new URL(import.meta.url).pathname);
const p = JSON.parse(fs.readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
const deps = { ...p.dependencies, '@gotcha/shared': 'file:vendor/gotcha-shared' };
delete deps['@types/compression'];
const out = {
  name: p.name, version: p.version, private: true,
  engines: { node: '>=20' },
  scripts: { start: 'node dist/main.js', 'db:deploy': 'prisma migrate deploy' },
  dependencies: Object.fromEntries(Object.entries(deps).sort(([a], [b]) => (a < b ? -1 : 1))),
};
fs.writeFileSync(path.join(process.argv[2], 'package.json'), JSON.stringify(out, null, 2) + '\n');

// --seed-lock <rootLock>: also write a package-lock.json seeded from the workspace lock, so
// `npm install --package-lock-only` keeps the exact versions the API was tested with.
// Regenerate deploy/package-lock.json with: scripts/make-deploy-lock.sh
if (process.argv[3] === '--seed-lock') {
  const r = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
  const pk = {};
  for (const [k, v] of Object.entries(r.packages)) if (k.startsWith('node_modules/') && !v.link && !k.startsWith('node_modules/@gotcha/')) pk[k] = v;
  for (const [k, v] of Object.entries(r.packages)) if (k.startsWith('services/api/node_modules/')) pk[k.slice('services/api/'.length)] = v;
  const lock = { name: out.name, version: out.version, lockfileVersion: 3, requires: true,
    packages: { '': { name: out.name, version: out.version, dependencies: out.dependencies, engines: out.engines }, ...pk } };
  fs.writeFileSync(path.join(process.argv[2], 'package-lock.json'), JSON.stringify(lock, null, 2) + '\n');
}
