/**
 * Deploy only Digital Asset Links JSON to production (no full frontend rebuild).
 * Usage: node scripts/deploy-assetlinks.mjs
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

if (!IP || !PASSWORD) {
  console.error('IP and PASSWORD required in deploy/.env');
  process.exit(1);
}

const sources = [
  {
    local: path.join(root, 'apps/web/public/.well-known/assetlinks.json'),
    remote: `${APP_DIR}/public/.well-known/assetlinks.json`,
  },
  {
    local: path.join(root, 'apps/web-learner/public/.well-known/assetlinks.json'),
    remote: `${APP_DIR}/public/learn/.well-known/assetlinks.json`,
  },
];

function sshExec(conn, cmd) {
  return new Promise((resolve, reject) => {
    conn.exec(cmd, (err, stream) => {
      if (err) return reject(err);
      let out = '';
      stream.on('data', (d) => {
        out += d.toString();
        process.stdout.write(d);
      });
      stream.stderr.on('data', (d) => process.stderr.write(d));
      stream.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`exit ${code}`))));
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
  await sshExec(conn, `mkdir -p ${APP_DIR}/public/.well-known ${APP_DIR}/public/learn/.well-known`);
  for (const { local, remote } of sources) {
    const body = fs.readFileSync(local);
    await new Promise((resolve, reject) => {
      conn.sftp((err, sftp) => {
        if (err) return reject(err);
        const stream = sftp.createWriteStream(remote);
        stream.on('close', () => {
          sftp.end();
          resolve();
        });
        stream.on('error', reject);
        stream.end(body);
      });
    });
    console.log(`Uploaded ${local} -> ${remote}`);
  }
  console.log('Asset links deploy complete.');
} finally {
  conn.end();
}
