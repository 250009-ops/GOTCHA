/**
 * Deploy the marketing site only. Does not remove /learn or /admin.
 * Usage: node scripts/deploy-web-only.mjs
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
const VITE_LEARNER_APP_URL = (process.env.VITE_LEARNER_APP_URL || `https://${DOMAIN}/learn`).trim();
const VITE_ADMIN_APP_URL = (process.env.VITE_ADMIN_APP_URL || `https://${DOMAIN}/admin`).trim();

if (!IP || !PASSWORD || !DOMAIN) {
  console.error('IP, PASSWORD, and DOMAIN required in deploy/.env');
  process.exit(1);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
console.log(`==> Building marketing site for ${DOMAIN}`);
const build = spawnSync(npm, ['run', 'build', '--workspace=apps/web'], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    VITE_BASE: '/',
    VITE_API_URL,
    VITE_WEB_URL,
    VITE_MARKETING_URL: VITE_WEB_URL,
    VITE_LEARNER_APP_URL,
    VITE_ADMIN_APP_URL,
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const distDir = path.join(root, 'apps/web/dist');
const assets = fs.readdirSync(path.join(distDir, 'assets')).filter((f) => f.endsWith('.js'));
const blob = assets.map((f) => fs.readFileSync(path.join(distDir, 'assets', f), 'utf8')).join('\n');
if (blob.includes('localhost:3000') || !blob.includes('20 ta Mashq')) {
  console.error('Refusing to upload: marketing build is missing the Mashq limit or points at localhost');
  process.exit(1);
}

const tarPath = path.join(os.tmpdir(), `gotcha-web-${Date.now()}.tgz`);
const packed = spawnSync('tar', ['-czf', tarPath, '-C', distDir, '.'], { stdio: 'inherit' });
if (packed.status !== 0) process.exit(packed.status ?? 1);

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
  await sshExec(conn, 'mkdir -p /tmp/gotcha-web-up');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(tarPath, '/tmp/gotcha-web-up/dist.tgz', (e) => {
        sftp.end();
        e ? reject(e) : resolve();
      });
    });
  });
  await sshExec(
    conn,
    [
      'set -e',
      'rm -rf /tmp/gotcha-web-extract && mkdir /tmp/gotcha-web-extract',
      'tar -xzf /tmp/gotcha-web-up/dist.tgz -C /tmp/gotcha-web-extract',
      `mkdir -p ${APP_DIR}/public`,
      `cp -a /tmp/gotcha-web-extract/. ${APP_DIR}/public/`,
      'nginx -t && systemctl reload nginx',
      'echo OK',
    ].join(' && '),
  );
  console.log(`Marketing site updated: https://${DOMAIN}/`);
} finally {
  conn.end();
  try { fs.unlinkSync(tarPath); } catch { /* ignore */ }
}
