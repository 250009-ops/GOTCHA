import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hex = (n) => crypto.randomBytes(n).toString('hex');

function get(file, key) {
  const m = file.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

const rootEnvPath = path.join(root, '.env');
const rootEnv = fs.existsSync(rootEnvPath) ? fs.readFileSync(rootEnvPath, 'utf8') : '';
const donishEnv = fs.readFileSync('C:/projects/donish_edu/backend/.env', 'utf8');

const openai = get(rootEnv, 'OPENAI_API_KEY');
const ip = get(donishEnv, 'IP');
const password = get(donishEnv, 'PASSWORD');
const domain = 'vps10094.eskiz.uz';

const jwtSecret = hex(48);
const dbPassword = hex(24);
const s3Secret = hex(24);

const deployEnv = `# Gotcha — Eskiz VPS2 (single-host full stack)
# Do not commit. Used by scripts/deploy-vps.mjs and server runtime.

NODE_ENV=production

# Deploy access
IP=${ip}
PASSWORD=${password}
DOMAIN=${domain}
VPS_APP_DIR=/var/www/gotcha

# Generated secrets
JWT_SECRET=${jwtSecret}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
DB_PASSWORD=${dbPassword}
S3_ACCESS_KEY=gotcha
S3_SECRET_KEY=${s3Secret}

# Runtime on VPS (everything on one machine)
DATABASE_URL=postgresql://gotcha:${dbPassword}@127.0.0.1:5434/gotcha?schema=public
REDIS_URL=redis://127.0.0.1:6380
S3_ENDPOINT=http://127.0.0.1:9100
S3_BUCKET=gotcha-content
S3_REGION=us-east-1
S3_FORCE_PATH_STYLE=true
UPLOADS_DIR=/var/www/gotcha/uploads

OPENAI_API_KEY=${openai}
OPENAI_MODEL_LOOKUP=gpt-4.1-mini
OPENAI_MODEL_QUIZ=gpt-4.1-mini

API_PORT=3200
API_CORS_ORIGINS=https://${domain}
DEV_AUTH_ANY_CREDENTIAL=false
DEV_UNLIMITED_IMPORTS=false
WORKER_CONCURRENCY=5

# Frontend public URLs (baked into static builds)
VITE_API_URL=https://${domain}/api/v1
VITE_WEB_URL=https://${domain}
VITE_MARKETING_URL=https://${domain}
VITE_LEARNER_APP_URL=https://${domain}/learn
VITE_ADMIN_APP_URL=https://${domain}/admin
`;

fs.mkdirSync(path.join(root, 'deploy'), { recursive: true });
fs.writeFileSync(path.join(root, 'deploy', '.env'), deployEnv);
fs.chmodSync(path.join(root, 'deploy', '.env'), 0o600);

let env = rootEnv;
if (!/^IP=/m.test(env)) {
  env += `

# --- Eskiz VPS2 deploy (single-host full stack; secrets live in deploy/.env) ---
IP=${ip}
PASSWORD=${password}
DOMAIN=${domain}
DB_PASSWORD=${dbPassword}
VPS_APP_DIR=/var/www/gotcha
`;
  fs.writeFileSync(rootEnvPath, env);
}

console.log('Wrote deploy/.env');
console.log(`DOMAIN=${domain} IP=${ip} OPENAI=${openai ? 'set' : 'empty'}`);
