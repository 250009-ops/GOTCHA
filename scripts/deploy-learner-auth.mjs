/**
 * Deploy web-learner dist + domain-root assetlinks.json only.
 * Usage: node scripts/deploy-learner-auth.mjs
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
const APP_DIR = process.env.VPS_APP_DIR?.trim() || '/var/www/gotcha';

if (!IP || !PASSWORD) {
  console.error('IP/PASSWORD required in deploy/.env');
  process.exit(1);
}

function runLocal(cmd, args, envExtra = {}) {
  console.log(`==> ${cmd} ${args.join(' ')}`);
  const useShell = process.platform === 'win32' && /\.cmd$/i.test(cmd);
  const r = spawnSync(cmd, args, {
    stdio: 'inherit',
    cwd: root,
    shell: useShell,
    env: { ...process.env, ...envExtra },
  });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
}

function sshExec(conn, cmd, timeoutMs = 120_000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error('timeout'));
      }, timeoutMs);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error(`exit ${code}`));
      });
    });
  });
}

function upload(conn, local, remote) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(local, remote, (e) => {
        sftp.end();
        e ? reject(e) : resolve();
      });
    });
  });
}

console.log('==> Build web-learner');
runLocal(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build', '--workspace=apps/web-learner'], {
  ...process.env,
  VITE_BASE: '/learn/',
});

const tarName = `gotcha-learn-auth-${Date.now()}.tgz`;
const tarPath = path.join(os.tmpdir(), tarName);
const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'gotcha-learn-'));
fs.cpSync(path.join(root, 'apps/web-learner/dist'), path.join(stage, 'learn'), { recursive: true });
fs.mkdirSync(path.join(stage, 'well-known'), { recursive: true });
fs.cpSync(
  path.join(root, 'apps/web/public/.well-known/assetlinks.json'),
  path.join(stage, 'well-known/assetlinks.json'),
);
runLocal('tar', ['-czf', tarPath, '-C', stage, 'learn', 'well-known']);

const conn = new Client();
await new Promise((resolve, reject) => {
  conn.on('ready', resolve).on('error', reject).connect({
    host: IP,
    port: 22,
    username: 'root',
    password: PASSWORD,
    readyTimeout: 30_000,
  });
});

try {
  console.log('==> Upload learner + assetlinks');
  await sshExec(conn, 'mkdir -p /tmp/gotcha-learn-up');
  await upload(conn, tarPath, `/tmp/gotcha-learn-up/${tarName}`);
  await sshExec(
    conn,
    [
      'set -e',
      `APP=${APP_DIR}`,
      `tar -xzf /tmp/gotcha-learn-up/${tarName} -C /tmp/gotcha-learn-up`,
      'mkdir -p "$APP/public/learn" "$APP/public/.well-known"',
      'cp -a /tmp/gotcha-learn-up/learn/. "$APP/public/learn/"',
      'cp -a /tmp/gotcha-learn-up/well-known/assetlinks.json "$APP/public/.well-known/assetlinks.json"',
      `rm -rf /tmp/gotcha-learn-up/learn /tmp/gotcha-learn-up/well-known /tmp/gotcha-learn-up/${tarName}`,
      'nginx -t && systemctl reload nginx',
      'grep -R "Opening GOTCHA app" "$APP/public/learn/assets/"*.js >/dev/null && echo OK_LEARNER_HANDOFF || echo FAIL_LEARNER_HANDOFF',
      'test -f "$APP/public/.well-known/assetlinks.json" && echo OK_ASSETLINKS || echo FAIL_ASSETLINKS',
    ].join(' && '),
  );
  console.log('Learner auth deploy finished.');
} finally {
  conn.end();
  try {
    fs.unlinkSync(tarPath);
    fs.rmSync(stage, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
