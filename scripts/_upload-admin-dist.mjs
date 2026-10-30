/** Build and upload admin dist to production. */
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

if (!IP || !PASSWORD) {
  console.error('IP/PASSWORD required in deploy/.env');
  process.exit(1);
}

console.log(`==> Building admin for ${DOMAIN ?? 'production'} (VITE_BASE=/admin/)`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const build = spawnSync(npm, ['run', 'build', '--workspace=apps/admin'], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    VITE_BASE: '/admin/',
    VITE_API_URL,
    VITE_ADMIN_APP_URL: process.env.VITE_ADMIN_APP_URL || `https://${DOMAIN}/admin`,
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);

const indexHtml = fs.readFileSync(path.join(root, 'apps/admin/dist/index.html'), 'utf8');
if (!indexHtml.includes('/admin/assets/')) {
  console.error('Refusing to upload: admin build missing /admin/assets/ base path');
  process.exit(1);
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'gotcha-admin-'));
fs.cpSync(path.join(root, 'apps/admin/dist'), stage, { recursive: true });
const tarPath = path.join(os.tmpdir(), `gotcha-admin-${Date.now()}.tgz`);
const { spawnSync } = await import('node:child_process');
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
  await sshExec(conn, 'mkdir -p /tmp/gotcha-admin-up');
  await new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(tarPath, '/tmp/gotcha-admin-up/dist.tgz', (e) => {
        sftp.end();
        e ? reject(e) : resolve();
      });
    });
  });
  await sshExec(
    conn,
    `mkdir -p ${APP_DIR}/public/admin && rm -rf /tmp/gotcha-admin-extract && mkdir /tmp/gotcha-admin-extract && tar -xzf /tmp/gotcha-admin-up/dist.tgz -C /tmp/gotcha-admin-extract && cp -a /tmp/gotcha-admin-extract/. ${APP_DIR}/public/admin/ && nginx -t && systemctl reload nginx && echo OK`,
  );
} finally {
  conn.end();
  fs.rmSync(stage, { recursive: true, force: true });
  fs.unlinkSync(tarPath);
}

console.log('Admin frontend updated on production.');
