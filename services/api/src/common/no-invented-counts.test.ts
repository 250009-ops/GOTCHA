import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

// P3b (Kai): `npm test` fails if the banned fallback constant or the Figma mock count
// reappears anywhere in web/API/Android source (see scripts/check-no-invented-counts.mjs).
const script = join(__dirname, '..', '..', '..', '..', 'scripts', 'check-no-invented-counts.mjs');
const r = spawnSync(process.execPath, [script], { encoding: 'utf8' });
assert.equal(r.status, 0, `invented learner-count check failed:\n${r.stderr}${r.stdout}`);
console.log('no-invented-counts test passed');
