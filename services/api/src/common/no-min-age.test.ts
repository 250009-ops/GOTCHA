import * as assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const BAD = /13\s*\+|at least 13|under the age of 13|не менее 13|младше 13 лет|kamida 13|13 yoshgacha|minimum age|минимальн\S* возраст/i;
const walk = (d: string): string[] => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const hits = walk(join(__dirname, '..')).filter((f) => f.endsWith('.ts') && !f.endsWith('no-min-age.test.ts') && BAD.test(readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/no minimum age/gi, '')));
assert.deepEqual(hits, []);
console.log('no-min-age (api): OK');
