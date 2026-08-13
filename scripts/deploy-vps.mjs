/**
 * Deploy Gotcha full stack to Eskiz VPS2 (single host).
 * Requires deploy/.env with IP, PASSWORD, DOMAIN (from scripts/generate-vps-env.mjs).
 *
 * Usage: node scripts/deploy-vps.mjs
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
const DOMAIN = process.env.DOMAIN?.trim() || '';
const APP_DIR = process.env.VPS_APP_DIR?.trim() || '/var/www/gotcha';

if (!IP || !PASSWORD) {
  console.error('IP and PASSWORD required in deploy/.env');
  console.error('VPS not provided yet — fill IP/PASSWORD/DOMAIN when ready, then re-run.');
  process.exit(1);
}
if (!DOMAIN) {
  console.error('DOMAIN required in deploy/.env before deploy');
  process.exit(1);
}

// CRITICAL: Warn if Atmos is configured but payment gateway is disabled.
// This is the most common cause of "imports are free" regression on prod.
const atmosStoreId = process.env.ATMOS_STORE_ID?.trim();
const atmosConsumerKey = process.env.ATMOS_CONSUMER_KEY?.trim();
const atmosConsumerSecret = process.env.ATMOS_CONSUMER_SECRET?.trim();
const paymentGatewayEnabled = process.env.PAYMENT_GATEWAY_ENABLED?.trim()?.toLowerCase();
const importsUnlimited = process.env.IMPORTS_UNLIMITED?.trim()?.toLowerCase();

const atmosConfigured = Boolean(atmosStoreId && atmosConsumerKey && atmosConsumerSecret);

if (atmosConfigured && paymentGatewayEnabled !== 'true') {
  console.log('');
  console.log('⚠️  WARNING: ATMOS CONFIGURED BUT PAYMENT_GATEWAY_ENABLED=' + (paymentGatewayEnabled || '(empty)'));
  console.log('   Learners will see "Imports are free" after this deploy.');
  console.log('   If this is intentional (e.g. promo period), continue. Otherwise:');
  console.log('   Set PAYMENT_GATEWAY_ENABLED=true and IMPORTS_UNLIMITED=false in deploy/.env');
  console.log('');
  // Don't exit — allow deploy to proceed with warning. User may want free imports temporarily.
}
if (atmosConfigured && importsUnlimited === 'true') {
  console.log('');
  console.log('⚠️  WARNING: IMPORTS_UNLIMITED=true — all imports will be free (Atmos not charged).');
  console.log('');
}

function runLocal(cmd, args, opts = {}) {
  // Avoid shell:true so paths with spaces (e.g. "GOTCHA_android app") stay intact.
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, shell: false, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} failed (${r.status})`);
}

function sshExec(conn, cmd, timeoutMs = 600_000) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, { pty: true }, (err, stream) => {
      if (err) return reject(err);
      const timer = setTimeout(() => {
        stream.close();
        reject(new Error(`timeout: ${cmd.slice(0, 80)}`));
      }, timeoutMs);
      stream.on('data', (d) => process.stdout.write(d));
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => {
        clearTimeout(timer);
        code === 0 ? resolve() : reject(new Error(`exit ${code}: ${cmd.slice(0, 120)}`));
      });
    });
  });
}

function uploadFile(conn, localPath, remotePath) {
  return new Promise((resolve, reject) => {
    conn.sftp((err, sftp) => {
      if (err) return reject(err);
      sftp.fastPut(localPath, remotePath, (e) => {
        sftp.end();
        e ? reject(e) : resolve();
      });
    });
  });
}

console.log(`==> Packing project for ${IP} (${DOMAIN})`);
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const tarName = `gotcha-deploy-${stamp}.tgz`;
const tarPath = path.join(os.tmpdir(), tarName);

// Prefer tar.exe (Windows 10+) 
const excludes = [
  '--exclude=node_modules',
  '--exclude=.git',
  '--exclude=uploads',
  '--exclude=**/dist',
  '--exclude=**/.turbo',
  '--exclude=apps/mobile',
  '--exclude=apps/android',
  '--exclude=.env',
  '--exclude=services/api/eng.traineddata',
  '--exclude={0}',
  '--exclude=scripts/_probe-vps.mjs',
  '--exclude=scripts/_probe-vps2.mjs',
  '--exclude=scripts/_probe-vps3.mjs',
];
runLocal('tar', ['-czf', tarPath, ...excludes, '-C', root, '.']);

const conn = new Client();
await new Promise((resolve, reject) => {
  conn
    .on('ready', resolve)
    .on('error', reject)
    .connect({ host: IP, port: 22, username: 'root', password: PASSWORD, readyTimeout: 30000 });
});

try {
  console.log('==> Uploading archive');
  await sshExec(conn, `mkdir -p ${APP_DIR} /tmp/gotcha-upload`);
  await uploadFile(conn, tarPath, `/tmp/gotcha-upload/${tarName}`);

  console.log('==> Extract archive');
  await sshExec(
    conn,
    [
      `set -e`,
      `rm -rf ${APP_DIR}.prev`,
      `if [ -d ${APP_DIR}/services ]; then mv ${APP_DIR} ${APP_DIR}.prev; fi`,
      `mkdir -p ${APP_DIR}`,
      `tar -xzf /tmp/gotcha-upload/${tarName} -C ${APP_DIR}`,
      `mkdir -p ${APP_DIR}/deploy`,
      `chmod +x ${APP_DIR}/deploy/install.sh ${APP_DIR}/deploy/update.sh`,
      // keep previous uploads if any
      `if [ -d ${APP_DIR}.prev/uploads ]; then cp -a ${APP_DIR}.prev/uploads ${APP_DIR}/; fi`,
    ].join(' && '),
    120_000,
  );

  // Windows tar --exclude=.env also drops deploy/.env; upload secrets explicitly.
  console.log('==> Upload deploy/.env');
  await uploadFile(conn, path.join(root, 'deploy/.env'), `${APP_DIR}/deploy/.env`);
  await sshExec(conn, `chmod 600 ${APP_DIR}/deploy/.env`);

  console.log('==> Install');
  await sshExec(
    conn,
    [
      `set -e`,
      `export VPS_APP_DIR=${APP_DIR} DOMAIN=${DOMAIN}`,
      `bash ${APP_DIR}/deploy/install.sh`,
    ].join(' && '),
    900_000,
  );

  console.log('==> Health check');
  await sshExec(
    conn,
    `curl -sS -o /dev/null -w "api_docs=%{http_code}\\n" http://127.0.0.1:3200/api/docs; curl -sS -o /dev/null -w "nginx=%{http_code}\\n" -H "Host: ${DOMAIN}" http://127.0.0.1/; pm2 status || true`,
  );

  console.log(`\nDeploy finished: https://${DOMAIN}/`);
} finally {
  conn.end();
  try {
    fs.unlinkSync(tarPath);
  } catch {
    /* ignore */
  }
}
