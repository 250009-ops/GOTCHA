/**
 * Frontend-only production redeploy.
 * Always loads VITE_* from deploy/.env (never falls back to localhost).
 *
 * Usage: node scripts/redeploy-frontends.mjs
 *    or: npm run deploy:frontends
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire('C:/projects/donish_edu/backend/package.json');
const { Client } = require('ssh2');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(root, 'deploy/.env') });

const IP = process.env.IP?.trim();
const PASSWORD = process.env.PASSWORD?.trim();
const DOMAIN = process.env.DOMAIN?.trim();
const APP_DIR = process.env.VPS_APP_DIR?.trim() || '/var/www/gotcha';

const VITE_API_URL = (process.env.VITE_API_URL || `https://${DOMAIN}/api/v1`).trim();
const VITE_WEB_URL = (process.env.VITE_WEB_URL || `https://${DOMAIN}`).trim();
const VITE_MARKETING_URL = (process.env.VITE_MARKETING_URL || VITE_WEB_URL).trim();
const VITE_LEARNER_APP_URL = (process.env.VITE_LEARNER_APP_URL || `https://${DOMAIN}/learn`).trim();
const VITE_ADMIN_APP_URL = (process.env.VITE_ADMIN_APP_URL || `https://${DOMAIN}/admin`).trim();

if (!IP || !PASSWORD || !DOMAIN) {
  console.error('IP, PASSWORD, and DOMAIN required in deploy/.env');
  process.exit(1);
}
if (!VITE_API_URL || /localhost|127\.0\.0\.1/i.test(VITE_API_URL)) {
  console.error(`Refusing to build: VITE_API_URL must be public (got: ${VITE_API_URL})`);
  process.exit(1);
}

const viteEnv = {
  ...process.env,
  VITE_API_URL,
  VITE_WEB_URL,
  VITE_MARKETING_URL,
  VITE_LEARNER_APP_URL,
  VITE_ADMIN_APP_URL,
};

function runLocal(cmd, args, envExtra = {}) {
  console.log(`==> ${cmd} ${args.join(' ')}`);
  // Windows .cmd shims (npm.cmd) require a shell; tar.exe does not.
  const useShell = process.platform === 'win32' && /\.cmd$/i.test(cmd);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: root,
    shell: useShell,
    env: { ...viteEnv, ...envExtra },
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
}

function sshExec(conn, cmd, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`timeout: ${cmd.slice(0, 80)}`));
      }, timeoutMs);
      stream.on('data', (d) => {
        out += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => {
        out += d.toString();
        process.stderr.write(d);
      });
      stream.on('close', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve(out) : reject(new Error(`exit ${code}: ${cmd.slice(0, 120)}`));
      });
    });
  });
}

console.log(`==> Building frontends for ${DOMAIN}`);
console.log(`    VITE_API_URL=${VITE_API_URL}`);

runLocal(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build:publish', '--workspace=apps/web'] /* PAY2-24: publish guard (fails closed if apps/web has no build:publish) */, {
  VITE_BASE: '/',
});
runLocal(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace=apps/web-learner'], {
  VITE_BASE: '/learn/',
});
runLocal(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace=apps/admin'], {
  VITE_BASE: '/admin/',
});

// Local sanity check before upload
for (const rel of ['apps/web/dist', 'apps/web-learner/dist', 'apps/admin/dist']) {
  const dir = path.join(root, rel);
  const jsFiles = fs.readdirSync(path.join(dir, 'assets')).filter((f) => f.endsWith('.js'));
  let blob = '';
  for (const f of jsFiles) blob += fs.readFileSync(path.join(dir, 'assets', f), 'utf8');
  if (blob.includes('localhost:3000')) {
    throw new Error(`${rel} still contains localhost:3000 — VITE_API_URL was not baked in`);
  }
  if (!blob.includes('gotchaa.uz/api/v1') && !blob.includes(VITE_API_URL.replace(/^https?:\/\//, ''))) {
    // API URL might only appear if api client is in that bundle; web marketing may not call auth.
    console.warn(`WARN: ${rel} may not embed API URL (ok for marketing-only chunks)`);
  }
  console.log(`OK local: ${rel} has no localhost:3000`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const tarName = `gotcha-frontends-${stamp}.tgz`;
const tarPath = path.join(os.tmpdir(), tarName);

// Pack the three dist folders with fixed names for remote extract
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'gotcha-fe-'));
fs.cpSync(path.join(root, 'apps/web/dist'), path.join(stage, 'web'), { recursive: true });
fs.cpSync(path.join(root, 'apps/web-learner/dist'), path.join(stage, 'learn'), { recursive: true });
fs.cpSync(path.join(root, 'apps/admin/dist'), path.join(stage, 'admin'), { recursive: true });
runLocal('tar', ['-czf', tarPath, '-C', stage, 'web', 'learn', 'admin']);

const conn = new Client();
await new Promise((resolve, reject) => {
  conn
    .on('ready', resolve)
    .on('error', reject)
    .connect({ host: IP, port: 22, username: 'root', password: PASSWORD, readyTimeout: 30000 });
});

try {
  console.log('==> Uploading frontend archive');
  await sshExec(conn, 'mkdir -p /tmp/gotcha-upload');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(tarPath, `/tmp/gotcha-upload/${tarName}`, (e) => {
        sftp.end();
        e ? reject(e) : resolve();
      });
    });
  });

  console.log('==> Publishing to public/ + reload nginx');
  await sshExec(
    conn,
    [
      'set -e',
      `rm -rf ${APP_DIR}/public`,
      `mkdir -p ${APP_DIR}/public/learn ${APP_DIR}/public/admin`,
      `tar -xzf /tmp/gotcha-upload/${tarName} -C /tmp/gotcha-upload`,
      `cp -a /tmp/gotcha-upload/web/. ${APP_DIR}/public/`,
      `cp -a /tmp/gotcha-upload/learn/. ${APP_DIR}/public/learn/`,
      `cp -a /tmp/gotcha-upload/admin/. ${APP_DIR}/public/admin/`,
      `rm -rf /tmp/gotcha-upload/web /tmp/gotcha-upload/learn /tmp/gotcha-upload/admin /tmp/gotcha-upload/${tarName}`,
      'nginx -t && systemctl reload nginx',
    ].join(' && '),
  );

  console.log('==> Verify remote bundles');
  const verify = await sshExec(
    conn,
    [
      `echo '--- learner ---'`,
      `grep -R "localhost:3000" ${APP_DIR}/public/learn/assets/*.js >/dev/null && echo FAIL_LOCALHOST_LEARNER || echo OK_NO_LOCALHOST_LEARNER`,
      `grep -R "gotchaa.uz/api/v1" ${APP_DIR}/public/learn/assets/*.js >/dev/null && echo OK_API_LEARNER || echo FAIL_API_LEARNER`,
      `echo '--- admin ---'`,
      `grep -R "localhost:3000" ${APP_DIR}/public/admin/assets/*.js >/dev/null && echo FAIL_LOCALHOST_ADMIN || echo OK_NO_LOCALHOST_ADMIN`,
      `grep -R "gotchaa.uz/api/v1" ${APP_DIR}/public/admin/assets/*.js >/dev/null && echo OK_API_ADMIN || echo FAIL_API_ADMIN`,
      `echo '--- web ---'`,
      `grep -R "localhost:3000" ${APP_DIR}/public/assets/*.js >/dev/null && echo FAIL_LOCALHOST_WEB || echo OK_NO_LOCALHOST_WEB`,
    ].join('; '),
  );

  if (
    verify.includes('FAIL_LOCALHOST') ||
    verify.includes('FAIL_API_LEARNER') ||
    verify.includes('FAIL_API_ADMIN')
  ) {
    throw new Error('Remote bundle verification failed');
  }

  console.log(`\nFrontend redeploy complete: https://${DOMAIN}/`);
} finally {
  conn.end();
  try {
    fs.unlinkSync(tarPath);
  } catch {
    /* ignore */
  }
  try {
    fs.rmSync(stage, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
