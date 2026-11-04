/**
 * WL4-01: boots the REAL built API (dist/main.js) and checks GET /api/v1/health.
 * Needs `nest build` first and a local DB in BOOT_SMOKE_DATABASE_URL (or DATABASE_URL if it is local).
 * Runs from a temp cwd with SMTP/OpenAI/Atmos blanked, so no .env is read and nothing is sent anywhere.
 */
import * as assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const db = process.env.BOOT_SMOKE_DATABASE_URL ?? process.env.DATABASE_URL ?? '';
const host = db ? (new URL(db).searchParams.get('host') || new URL(db).hostname) : '';
if (!db || !(['localhost', '127.0.0.1', '::1'].includes(host) || host.startsWith('/'))) {
  console.log('boot-smoke: SKIP (set BOOT_SMOKE_DATABASE_URL to a local database)');
  process.exit(0);
}
const main = path.resolve(__dirname, '../dist/main.js');
assert.ok(fs.existsSync(main), 'run nest build first');
const port = 40000 + Math.floor(Math.random() * 10000);
const env: NodeJS.ProcessEnv = {
  PATH: process.env.PATH, HOME: os.tmpdir(), NODE_ENV: 'development', API_PORT: String(port), DATABASE_URL: db,
  JWT_SECRET: 'boot-smoke-only', JWT_REFRESH_SECRET: 'boot-smoke-only-r',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', OPENAI_API_KEY: '', ATMOS_CONSUMER_KEY: '', ATMOS_CONSUMER_SECRET: '',
};
const child = spawn(process.execPath, [main], { cwd: os.tmpdir(), env, stdio: ['ignore', 'pipe', 'pipe'] });
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));
const deadline = Date.now() + 60_000;
(async () => {
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`API exited ${child.exitCode}:\n${log.slice(-3000)}`);
    try {
      const r = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
      if (r.ok) {
        const h = (await r.json()) as { ok?: boolean; build?: { sha?: string } }; assert.equal(h.ok, true); assert.ok(h.build && typeof h.build.sha === 'string', 'S4 build id on /health');
        assert.ok(!/can't resolve dependencies/i.test(log));
        assert.ok(!/\[MAIL\].*sent|sendMail ok/i.test(log), 'no email at boot');
        console.log('boot-smoke: OK (Nest booted, /health 200)');
        return;
      }
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timeout:\n${log.slice(-3000)}`);
})()
  .catch((e) => { console.error(e.message ?? e); process.exitCode = 1; })
  .finally(() => child.kill('SIGTERM'));
