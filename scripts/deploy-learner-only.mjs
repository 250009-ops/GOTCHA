/**
 * Deploy web-learner only (skips marketing + admin builds).
 * Usage: node scripts/deploy-learner-only.mjs
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
const VITE_TELEGRAM_BOT_USERNAME = (process.env.VITE_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || 'gotchaa_app').replace(/^@/, '').trim();

if (!IP || !PASSWORD || !DOMAIN) {
  console.error('IP, PASSWORD, and DOMAIN required in deploy/.env');
  process.exit(1);
}

const viteEnv = {
  ...process.env,
  VITE_API_URL,
  VITE_WEB_URL,
  VITE_MARKETING_URL,
  VITE_LEARNER_APP_URL,
  VITE_ADMIN_APP_URL,
  VITE_TELEGRAM_BOT_USERNAME,
  VITE_BASE: '/learn/',
};

function runLocal(cmd, args) {
  console.log(`==> ${cmd} ${args.join(' ')}`);
  const useShell = process.platform === 'win32' && /\.cmd$/i.test(cmd);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: root,
    shell: useShell,
    env: viteEnv,
  });
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

console.log(`==> Building web-learner for ${DOMAIN}`);
runLocal(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace=apps/web-learner']);

const distDir = path.join(root, 'apps/web-learner/dist');
const jsFiles = fs.readdirSync(path.join(distDir, 'assets')).filter((f) => f.endsWith('.js'));
let blob = '';
for (const f of jsFiles) blob += fs.readFileSync(path.join(distDir, 'assets', f), 'utf8');
if (blob.includes('localhost:3000')) {
  throw new Error('web-learner dist still contains localhost:3000');
}
if (!blob.includes('readerLibraryReturn') && !blob.includes('resolveReaderLibraryReturn')) {
  console.warn('WARN: browse-return fix string not found in bundle (minification may have renamed symbols)');
}
console.log('OK local: web-learner dist has no localhost:3000');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const tarName = `gotcha-learn-${stamp}.tgz`;
const tarPath = path.join(os.tmpdir(), tarName);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'gotcha-learn-'));
fs.cpSync(distDir, path.join(stage, 'learn'), { recursive: true });
runLocal('tar', ['-czf', tarPath, '-C', stage, 'learn']);

const conn = new Client();
await new Promise((resolve, reject) => {
  conn
    .on('ready', resolve)
    .on('error', reject)
    .connect({ host: IP, port: 22, username: 'root', password: PASSWORD, readyTimeout: 30000 });
});

try {
  console.log('==> Uploading learner archive');
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

  console.log('==> Publishing to public/learn + reload nginx');
  await sshExec(
    conn,
    [
      'set -e',
      `mkdir -p ${APP_DIR}/public/learn`,
      `tar -xzf /tmp/gotcha-upload/${tarName} -C /tmp/gotcha-upload`,
      `rm -rf ${APP_DIR}/public/learn/*`,
      `cp -a /tmp/gotcha-upload/learn/. ${APP_DIR}/public/learn/`,
      `rm -rf /tmp/gotcha-upload/learn /tmp/gotcha-upload/${tarName}`,
      'nginx -t && systemctl reload nginx',
    ].join(' && '),
  );

  const verify = await sshExec(
    conn,
    [
      `grep -R "localhost:3000" ${APP_DIR}/public/learn/assets/*.js >/dev/null && echo FAIL_LOCALHOST || echo OK_NO_LOCALHOST`,
      `grep -R "gotchaa.uz/api/v1" ${APP_DIR}/public/learn/assets/*.js >/dev/null && echo OK_API || echo FAIL_API`,
    ].join('; '),
  );

  if (verify.includes('FAIL_LOCALHOST') || verify.includes('FAIL_API')) {
    throw new Error('Remote bundle verification failed');
  }

  console.log(`\nLearner redeploy complete: https://${DOMAIN}/learn/`);
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
