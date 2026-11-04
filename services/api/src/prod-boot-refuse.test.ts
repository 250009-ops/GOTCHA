/**
 * WLF-09: the REAL built API (dist/main.js) must exit before listening when NODE_ENV=production and
 * API_CORS_ORIGINS or ADMIN_APP_URL is unset. Runs from a temp cwd (no .env read), no DB, nothing sent.
 */
import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const main = path.resolve(__dirname, '../dist/main.js');
assert.ok(fs.existsSync(main), 'run nest build first');
const base: NodeJS.ProcessEnv = {
  PATH: process.env.PATH, HOME: os.tmpdir(), NODE_ENV: 'production', API_PORT: String(50000 + Math.floor(Math.random() * 9000)),
  JWT_SECRET: 'p'.repeat(40), JWT_REFRESH_SECRET: 'r'.repeat(40), DATABASE_URL: 'postgresql://none@127.0.0.1:1/none',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', OPENAI_API_KEY: '', ATMOS_CONSUMER_KEY: '', ATMOS_CONSUMER_SECRET: '',
};
const run = (env: NodeJS.ProcessEnv) => spawnSync(process.execPath, [main], { cwd: os.tmpdir(), env, encoding: 'utf8', timeout: 30_000 });
const a = run({ ...base, ADMIN_APP_URL: 'https://gotchaa.uz/admin' });
assert.notEqual(a.status, 0); assert.match(a.stderr + a.stdout, /API_CORS_ORIGINS must be set/);
const b = run({ ...base, API_CORS_ORIGINS: 'https://gotchaa.uz' });
assert.notEqual(b.status, 0); assert.match(b.stderr + b.stdout, /ADMIN_APP_URL must be set/);
assert.ok(!/Gotcha API running/.test(a.stdout + b.stdout), 'must not listen');
console.log('prod-boot-refuse: OK (dist exits without API_CORS_ORIGINS / ADMIN_APP_URL)');
