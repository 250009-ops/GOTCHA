// Runs every src/**/*.test.ts with ts-node (transpile-only); exits non-zero if any fail.
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;
const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith('.test.ts')) files.push(p);
  }
})(join(root, 'src'));

let failed = 0;
for (const f of files.sort()) {
  const r = spawnSync('npx', ['ts-node', '--transpile-only', f], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) {
    failed++;
    console.error(`FAIL ${relative(root, f)}`);
  }
}
console.log(`\n${files.length - failed}/${files.length} test files passed`);
process.exit(failed ? 1 : 0);
