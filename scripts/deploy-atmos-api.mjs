/**
 * Sync Atmos/billing env to VPS, deploy latest API+billing code, migrate, restart.
 * Usage: node scripts/deploy-atmos-api.mjs
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

const syncScript = `const fs = require('fs');
const app = process.argv[2];
const deployEnv = fs.readFileSync(app + '/deploy/.env', 'utf8');
const get = (k) => {
  const m = deployEnv.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim() : '';
};
const keys = [
  'PAYMENT_GATEWAY_ENABLED','IMPORTS_UNLIMITED','DEV_UNLIMITED_IMPORTS',
  'ATMOS_CONSUMER_KEY','ATMOS_CONSUMER_SECRET','ATMOS_STORE_ID','ATMOS_API_KEY',
  'ATMOS_API_BASE','ATMOS_IKPU','ATMOS_MIN_AMOUNT_SOM','ATMOS_MERCHANT_TIN'
];
let runtime = fs.existsSync(app + '/.env') ? fs.readFileSync(app + '/.env', 'utf8') : '';
for (const k of keys) {
  let v = get(k);
  if (k === 'PAYMENT_GATEWAY_ENABLED') v = 'true';
  if (k === 'IMPORTS_UNLIMITED' || k === 'DEV_UNLIMITED_IMPORTS') v = 'false';
  if (v === '' && k === 'ATMOS_API_KEY') continue;
  if (v === '' && !get(k) && k.startsWith('ATMOS_') && k !== 'ATMOS_API_KEY') {
    console.warn('missing', k);
  }
  const line = k + '=' + v;
  if (new RegExp('^' + k + '=', 'm').test(runtime)) {
    runtime = runtime.replace(new RegExp('^' + k + '=.*$', 'm'), line);
  } else {
    runtime += '\\n' + line;
  }
}
if (!runtime.endsWith('\\n')) runtime += '\\n';
// Remove deprecated terminal override — Atmos auto-selects the store terminal.
runtime = runtime.replace(/^ATMOS_TERMINAL_ID=.*\\n?/m, '');
fs.writeFileSync(app + '/.env', runtime);
console.log('Atmos env synced; gateway enabled');
`;

console.log('==> Pack API sources');
const tarName = `gotcha-api-${Date.now()}.tgz`;
const tarPath = path.join(os.tmpdir(), tarName);
const syncPath = path.join(os.tmpdir(), 'sync-atmos-env.cjs');
fs.writeFileSync(syncPath, syncScript);

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
  'deploy/.env',
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
  await upload(conn, syncPath, '/tmp/gotcha-api-up/sync-atmos-env.cjs');

  console.log('==> Extract, sync env, build, migrate, restart');
  await sshExec(
    conn,
    [
      'set -e',
      `APP=${APP_DIR}`,
      `tar -xzf /tmp/gotcha-api-up/${tarName} -C "$APP"`,
      'node /tmp/gotcha-api-up/sync-atmos-env.cjs "$APP"',
      'grep -E "^(PAYMENT_|IMPORTS_|ATMOS_STORE|ATMOS_API_BASE|ATMOS_IKPU)" "$APP/.env" | sed -E "s/(SECRET|KEY)=.*/\\1=***/"',
      'ln -sfn "$APP/.env" "$APP/services/api/.env"',
      'ln -sfn "$APP/.env" "$APP/services/worker/.env"',
      'cd "$APP"',
      'npm ci',
      'npm run build --workspace=packages/shared --if-present',
      'npm run db:generate',
      'rm -rf services/api/dist',
      'rm -f services/api/*.tsbuildinfo',
      'npm run build --workspace=services/api',
      'test -f services/api/dist/main.js',
      'cd services/api && npx prisma migrate deploy && cd "$APP"',
      'grep -q gateway-status services/api/dist/modules/billing/billing.controller.js && echo OK_ROUTE_gateway-status',
      'VPS_APP_DIR="$APP" pm2 startOrReload deploy/ecosystem.config.cjs --update-env',
      'pm2 save',
      'sleep 12',
      'curl -sS http://127.0.0.1:3200/api/v1/billing/gateway-status; echo',
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
  try {
    fs.unlinkSync(syncPath);
  } catch {
    /* ignore */
  }
}

console.log('API Atmos deploy finished.');
