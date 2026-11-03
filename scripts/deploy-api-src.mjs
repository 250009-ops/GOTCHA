/**
 * Upload API source, rebuild, and restart PM2. Does not change VPS env.
 * Usage: node scripts/deploy-api-src.mjs
 */
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
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

function runLocal(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: false });
  if (r.status !== 0) throw new Error(`${cmd} failed`);
}

function sshExec(conn, cmd, timeoutMs = 600_000) {
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

function buildSha() {
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout || '';
  const head = git(['rev-parse', 'HEAD']).trim();
  const diff = git(['diff', 'HEAD']);
  const untracked = git(['ls-files', '--others', '--exclude-standard']);
  if (head && !diff && !untracked.trim()) return head.slice(0, 12);
  return crypto.createHash('sha256').update(head).update('\n').update(diff).update('\n').update(untracked).digest('hex').slice(0, 12);
}

const BUILD_SHA = buildSha();
const BUILD_DATE = new Date().toISOString().slice(0, 10);
console.log(`==> Build sha ${BUILD_SHA}`);

const tarName = `gotcha-api-${Date.now()}.tgz`;
const tarPath = path.join(os.tmpdir(), tarName);

console.log('==> Pack API sources');
runLocal('tar', [
  '-czf',
  tarPath,
  '-C',
  root,
  'services/api/src',
  'services/api/package.json',
  'services/api/tsconfig.json',
  'services/api/tsconfig.build.json',
  'services/api/nest-cli.json',
  'services/api/prisma',
  'packages/shared',
  'deploy/ecosystem.config.cjs',
]);

const conn = new Client();
await new Promise((r, j) =>
  conn.on('ready', r).on('error', j).connect({
    host: IP,
    port: 22,
    username: 'root',
    password: PASSWORD,
    readyTimeout: 25000,
  }),
);

try {
  console.log('==> Upload');
  await sshExec(conn, 'mkdir -p /tmp/gotcha-api-up');
  await upload(conn, tarPath, `/tmp/gotcha-api-up/${tarName}`);

  console.log('==> Extract, build, restart');
  await sshExec(
    conn,
    [
      'set -e',
      `APP=${APP_DIR}`,
      `tar -xzf /tmp/gotcha-api-up/${tarName} -C "$APP"`,
      'ln -sfn "$APP/.env" "$APP/services/api/.env"',
      'cd "$APP"',
      'npm run build --workspace=packages/shared --if-present',
      'npm run db:generate',
      'rm -rf services/api/dist',
      'rm -f services/api/*.tsbuildinfo',
      'npm run build --workspace=services/api',
      'test -f services/api/dist/main.js',
      `node -e "require('fs').writeFileSync('services/api/dist/build-info.json', JSON.stringify({sha:'${BUILD_SHA}',date:'${BUILD_DATE}'}))"`,
      'cd services/api && npx prisma migrate deploy && cd "$APP"',
      'VPS_APP_DIR="$APP" pm2 startOrReload deploy/ecosystem.config.cjs --update-env',
      'pm2 save',
    ].join(' && '),
    900_000,
  );
} finally {
  conn.end();
  try {
    fs.unlinkSync(tarPath);
  } catch {
    /* ignore */
  }
}

console.log('API source deploy finished.');
