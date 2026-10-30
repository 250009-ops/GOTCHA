/**
 * Upload latest restore script + run on production VPS.
 * Usage: node scripts/_restore-admin-remote.mjs
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
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
const localScript = path.join(root, 'services/api/scripts/restore-admin-credentials.mjs');
const remoteScript = `${APP_DIR}/services/api/scripts/restore-admin-credentials.mjs`;

if (!IP || !PASSWORD) {
  console.error('IP/PASSWORD required in deploy/.env');
  process.exit(1);
}

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

function uploadFile(conn, local, remote) {
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

const conn = new Client();
await new Promise((resolve, reject) => {
  conn.on('ready', resolve).on('error', reject).connect({
    host: IP,
    port: 22,
    username: 'root',
    password: PASSWORD,
    readyTimeout: 30000,
  });
});

try {
  console.log('==> Upload latest restore script');
  await uploadFile(conn, localScript, remoteScript);

  console.log('==> Restoring admin credentials');
  await sshExec(conn, `cd ${APP_DIR}/services/api && npm run restore-admin`);

  console.log('\n==> Admin accounts after restore');
  await sshExec(
    conn,
    `cd ${APP_DIR}/services/api && node --input-type=module -e "import { PrismaClient } from '@prisma/client'; const p = new PrismaClient(); const admins = await p.adminUser.findMany({ include: { user: { select: { email: true, emailVerifiedAt: true } } } }); for (const a of admins) console.log(a.role, a.user.email, a.user.emailVerifiedAt ? 'verified' : 'UNVERIFIED'); await p.\\$disconnect();"`,
  );

  console.log('\n==> Login check');
  await sshExec(
    conn,
    `curl -sS -X POST http://127.0.0.1:3200/api/v1/auth/login -H 'Content-Type: application/json' -d '${JSON.stringify({ email: 'admin@gotcha.app', password: process.env.ADMIN_PASSWORD ?? '' }).replace(/'/g, "'\\''")}' | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{const j=JSON.parse(s); console.log('isAdmin:', j.isAdmin, 'email:', j.user?.email);});"`,
  );
} finally {
  conn.end();
}
