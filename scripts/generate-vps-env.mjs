import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Create/refresh deploy/.env secrets for Eskiz VPS2 (single-host full stack).
 * Does NOT deploy. Fill IP / PASSWORD / DOMAIN when the VPS is provided, then run deploy:vps.
 */
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hex = (n) => crypto.randomBytes(n).toString('hex');

function get(file, key) {
  const m = file.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return m ? m[1].trim() : '';
}

const rootEnvPath = path.join(root, '.env');
const deployEnvPath = path.join(root, 'deploy', '.env');
const rootEnv = fs.existsSync(rootEnvPath) ? fs.readFileSync(rootEnvPath, 'utf8') : '';
const existing = fs.existsSync(deployEnvPath) ? fs.readFileSync(deployEnvPath, 'utf8') : '';

const openai = get(rootEnv, 'OPENAI_API_KEY') || get(existing, 'OPENAI_API_KEY');
const ip = get(existing, 'IP') || get(rootEnv, 'IP');
const password = get(existing, 'PASSWORD') || get(rootEnv, 'PASSWORD');
const domain = get(existing, 'DOMAIN') || get(rootEnv, 'DOMAIN');

const jwtSecret = get(existing, 'JWT_SECRET') || hex(48);
const dbPassword = get(existing, 'DB_PASSWORD') || get(rootEnv, 'DB_PASSWORD') || hex(24);
const s3Secret = get(existing, 'S3_SECRET_KEY') || hex(24);

// Atmos payment gateway credentials — preserve from existing env if set
const atmosConsumerKey = get(existing, 'ATMOS_CONSUMER_KEY') || get(rootEnv, 'ATMOS_CONSUMER_KEY');
const atmosConsumerSecret = get(existing, 'ATMOS_CONSUMER_SECRET') || get(rootEnv, 'ATMOS_CONSUMER_SECRET');
const atmosStoreId = get(existing, 'ATMOS_STORE_ID') || get(rootEnv, 'ATMOS_STORE_ID');
const atmosApiKey = get(existing, 'ATMOS_API_KEY') || get(rootEnv, 'ATMOS_API_KEY');
const atmosApiBase = get(existing, 'ATMOS_API_BASE') || get(rootEnv, 'ATMOS_API_BASE') || 'https://apigw.atmos.uz';
const atmosIkpu = get(existing, 'ATMOS_IKPU') || get(rootEnv, 'ATMOS_IKPU') || '10899001001000000';
const atmosMerchantTin = get(existing, 'ATMOS_MERCHANT_TIN') || get(rootEnv, 'ATMOS_MERCHANT_TIN');

// Payment gateway settings — preserve existing or default to disabled
const importsUnlimited = get(existing, 'IMPORTS_UNLIMITED') || get(rootEnv, 'IMPORTS_UNLIMITED') || 'false';
const paymentGatewayEnabled = get(existing, 'PAYMENT_GATEWAY_ENABLED') || get(rootEnv, 'PAYMENT_GATEWAY_ENABLED') || 'false';

const publicHost = domain || 'YOUR_DOMAIN';

const deployEnv = `# Gotcha — Eskiz VPS2 (single-host full stack)
# Do not commit. Fill IP/PASSWORD/DOMAIN when you provide the VPS, then: npm run deploy:vps

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
OPENAI_MODEL_IMPORT=gpt-4.1-mini
IMPORT_AI_CLEANUP_ENABLED=true

API_PORT=3200
API_CORS_ORIGINS=https://${publicHost},https://www.${publicHost}
LEARNER_APP_URL=https://${publicHost}/learn
DEV_AUTH_ANY_CREDENTIAL=false
DEV_UNLIMITED_IMPORTS=false
WORKER_CONCURRENCY=5

# Atmos payment gateway — see docs/ATMOS.md for setup. Fill credentials to enable paid imports.
# When ready to charge, set PAYMENT_GATEWAY_ENABLED=true and IMPORTS_UNLIMITED=false.
ATMOS_CONSUMER_KEY=${atmosConsumerKey}
ATMOS_CONSUMER_SECRET=${atmosConsumerSecret}
ATMOS_STORE_ID=${atmosStoreId}
ATMOS_API_KEY=${atmosApiKey}
ATMOS_API_BASE=${atmosApiBase}
ATMOS_IKPU=${atmosIkpu}
ATMOS_MERCHANT_TIN=${atmosMerchantTin}
IMPORTS_UNLIMITED=${importsUnlimited}
PAYMENT_GATEWAY_ENABLED=${paymentGatewayEnabled}

# SMTP — Eskiz Mail (mail.${publicHost}, SSL 465). Set SMTP_PASS to the mailbox password.
SMTP_HOST=mail.${publicHost}
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=noreply@${publicHost}
SMTP_PASS=
SMTP_FROM=GOTCHA <noreply@${publicHost}>

# Frontend public URLs (baked into static builds)
VITE_API_URL=https://${publicHost}/api/v1
VITE_WEB_URL=https://${publicHost}
VITE_MARKETING_URL=https://${publicHost}
VITE_LEARNER_APP_URL=https://${publicHost}/learn
VITE_ADMIN_APP_URL=https://${publicHost}/admin
`;

fs.mkdirSync(path.join(root, 'deploy'), { recursive: true });
fs.writeFileSync(deployEnvPath, deployEnv);

let env = rootEnv.replace(/\n*# --- Eskiz VPS2[\s\S]*$/, '');
env += `

# --- Eskiz VPS2 deploy (single-host full stack; fill when VPS is provided) ---
# Production secrets live in deploy/.env — do not run deploy:vps until IP/PASSWORD/DOMAIN are set.
IP=${ip}
PASSWORD=${password}
DOMAIN=${domain}
DB_PASSWORD=${dbPassword}
VPS_APP_DIR=/var/www/gotcha
`;
fs.writeFileSync(rootEnvPath, env);

console.log('Wrote deploy/.env (secrets ready; host fields left blank until VPS is provided)');
console.log(`IP=${ip || '(empty)'} DOMAIN=${domain || '(empty)'} OPENAI=${openai ? 'set' : 'empty'}`);
