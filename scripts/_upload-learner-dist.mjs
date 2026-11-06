/**
 * Build and upload learner dist to production (/learn/) only.
 * Does not touch marketing, admin, or the API.
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

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
const VITE_TELEGRAM_BOT_USERNAME = (process.env.VITE_TELEGRAM_BOT_USERNAME || process.env.TELEGRAM_BOT_USERNAME || 'gotchaa_app').replace(/^@/, '').trim();

if (!IP || !PASSWORD || !DOMAIN) {
  console.error('IP, PASSWORD, and DOMAIN required in deploy/.env');
  process.exit(1);
}
if (!VITE_API_URL || /localhost|127\.0\.0\.1/i.test(VITE_API_URL)) {
  console.error(`Refusing to build: VITE_API_URL must be public (got: ${VITE_API_URL})`);
  process.exit(1);
}

console.log(`==> Building learner for ${DOMAIN} (VITE_BASE=/learn/)`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build', '--workspace=apps/web-learner'], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    VITE_BASE: '/learn/',
    VITE_API_URL,
    VITE_WEB_URL,
    VITE_MARKETING_URL,
    VITE_LEARNER_APP_URL,
    VITE_TELEGRAM_BOT_USERNAME,
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const dist = path.join(root, 'apps/web-learner/dist');
const indexHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!indexHtml.includes('/learn/assets/')) {
  console.error('Refusing to upload: learner build missing /learn/assets/ base path');
  process.exit(1);
}

const assetsDir = path.join(dist, 'assets');
const jsFiles = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
let blob = '';
for (const f of jsFiles) blob += fs.readFileSync(path.join(assetsDir, f), 'utf8');
if (blob.includes('localhost:3000')) {
  console.error('Refusing to upload: learner bundle still contains localhost:3000');
  process.exit(1);
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'gotcha-learn-'));
fs.cpSync(dist, stage, { recursive: true });
const tarPath = path.join(os.tmpdir(), `gotcha-learn-${Date.now()}.tgz`);
spawnSync('tar', ['-czf', tarPath, '-C', stage, '.'], { stdio: 'inherit' });

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    });
  });
}

const conn = new Client();
await new Promise((resolve, reject) => {
  conn.on('ready', resolve).on('error', reject).connect({
    host: IP, port: 22, username: 'root', password: PASSWORD, readyTimeout: 30000,
  });
});

try {
  await sshExec(conn, 'mkdir -p /tmp/gotcha-learn-up');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(tarPath, '/tmp/gotcha-learn-up/dist.tgz', (e) => {
        sftp.end();
        e ? reject(e) : resolve();
      });
    });
  });
  await sshExec(
    conn,
    [
      'set -e',
      `mkdir -p ${APP_DIR}/public/learn`,
      'rm -rf /tmp/gotcha-learn-extract',
      'mkdir /tmp/gotcha-learn-extract',
      'tar -xzf /tmp/gotcha-learn-up/dist.tgz -C /tmp/gotcha-learn-extract',
      `find ${APP_DIR}/public/learn -mindepth 1 -maxdepth 1 -exec rm -rf {} +`,
      `cp -a /tmp/gotcha-learn-extract/. ${APP_DIR}/public/learn/`,
      'rm -rf /tmp/gotcha-learn-extract /tmp/gotcha-learn-up',
      'nginx -t && systemctl reload nginx',
      `grep -R "localhost:3000" ${APP_DIR}/public/learn/assets/*.js >/dev/null && echo FAIL_LOCALHOST_LEARNER || echo OK_NO_LOCALHOST_LEARNER`,
      `grep -R "gotchaa.uz/api/v1" ${APP_DIR}/public/learn/assets/*.js >/dev/null && echo OK_API_LEARNER || echo FAIL_API_LEARNER`,
    ].join(' && '),
  );
} finally {
  conn.end();
  fs.rmSync(stage, { recursive: true, force: true });
  try {
    fs.unlinkSync(tarPath);
  } catch {
    /* ignore */
  }
}

console.log(`Learner frontend updated: https://${DOMAIN}/learn/`);
