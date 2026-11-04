// Runs every src/**/*.test.ts (ts-node), then builds and runs the dist tests (EPUB, boot smoke).
import { execSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const dist = ['src/boot-smoke.test.ts', 'src/modules/imports/epub-dist.test.ts', 'src/prod-boot-refuse.test.ts'].map((p) => p.replace(/\//g, '/'));
const unit = walk('src').filter((p) => p.endsWith('.test.ts') && !dist.includes(p.replace(/\\/g, '/'))).sort();
const env = { ...process.env, TS_NODE_COMPILER_OPTIONS: '{"esModuleInterop":true}' };
let failed = [];
const run = (f) => { try { execSync(`npx ts-node --transpile-only ${f}`, { stdio: 'inherit', env }); } catch { failed.push(f); } };
unit.forEach(run);
execSync('npx nest build', { stdio: 'inherit' });
dist.forEach((f) => { try { execSync(`npx ts-node --transpile-only ${f}`, { stdio: 'inherit' }); } catch { failed.push(f); } });
console.log(`\n${unit.length + dist.length - failed.length}/${unit.length + dist.length} test files passed`);
if (failed.length) { console.log('FAILED:\n' + failed.join('\n')); process.exit(1); }
