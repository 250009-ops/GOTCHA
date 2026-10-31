// S4: build id from dist/build-info.json; safe fallback when absent.
import * as assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readBuildInfo } from './health.controller';
const d = mkdtempSync(join(tmpdir(), 'bi-'));
assert.deepEqual(readBuildInfo(d), { sha: 'dev', date: 'unknown' });
writeFileSync(join(d, 'build-info.json'), JSON.stringify({ sha: 'abc1234', date: '2026-10-31' }));
assert.deepEqual(readBuildInfo(d), { sha: 'abc1234', date: '2026-10-31' });
console.log('health-build-info: 2/2 OK');
