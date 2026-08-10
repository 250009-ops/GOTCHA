#!/usr/bin/env bash
# Gotcha — production install on one Eskiz VPS (Ubuntu 24.04)
# Run as root after code is synced to VPS_APP_DIR:
#   sudo bash deploy/install.sh

set -euo pipefail

APP_DIR="${VPS_APP_DIR:-/var/www/gotcha}"
CERTBOT_EMAIL_DEFAULT=""
SKIP_SSL="${SKIP_SSL:-0}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/install.sh"
  exit 1
fi

if [[ ! -f "${APP_DIR}/deploy/.env" ]]; then
  echo "Missing ${APP_DIR}/deploy/.env — copy production keys first"
  exit 1
fi

get_env() {
  local key="$1"
  grep -E "^${key}=" "${APP_DIR}/deploy/.env" | head -1 | cut -d= -f2-
}

DOMAIN="${DOMAIN:-$(get_env DOMAIN)}"
if [[ -z "${DOMAIN}" || "${DOMAIN}" == "YOUR_DOMAIN" ]]; then
  echo "Set DOMAIN in deploy/.env before install"
  exit 1
fi
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@${DOMAIN}}"
DB_PASSWORD="$(get_env DB_PASSWORD)"
S3_SECRET_KEY="$(get_env S3_SECRET_KEY)"
S3_ACCESS_KEY="$(get_env S3_ACCESS_KEY)"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-gotcha}"
JWT_SECRET="$(get_env JWT_SECRET)"
JWT_EXPIRES_IN="$(get_env JWT_EXPIRES_IN)"
JWT_REFRESH_EXPIRES_IN="$(get_env JWT_REFRESH_EXPIRES_IN)"
OPENAI_API_KEY="$(get_env OPENAI_API_KEY)"
OPENAI_MODEL_LOOKUP="$(get_env OPENAI_MODEL_LOOKUP)"
OPENAI_MODEL_QUIZ="$(get_env OPENAI_MODEL_QUIZ)"
S3_BUCKET="$(get_env S3_BUCKET)"
S3_REGION="$(get_env S3_REGION)"
WORKER_CONCURRENCY="$(get_env WORKER_CONCURRENCY)"

[[ -n "$DB_PASSWORD" ]] || { echo "DB_PASSWORD required in deploy/.env"; exit 1; }
[[ -n "$S3_SECRET_KEY" ]] || { echo "S3_SECRET_KEY required in deploy/.env"; exit 1; }
[[ -n "$JWT_SECRET" ]] || { echo "JWT_SECRET required in deploy/.env"; exit 1; }

echo "==> System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl nginx certbot python3-certbot-nginx ca-certificates

# Node 22+: jsdom@30 nested undici needs newer runtime (fails on Node 20)
if ! command -v node &>/dev/null || [[ "$(node -v | cut -d. -f1 | tr -d v)" -lt 22 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi

if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
fi

# SSH key for deploy PC
PUBKEY='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIKULThzQwR8XFOovjcdMxIJsfHLHNy2XbwUeyFWQx//L admin@DESKTOP-84A2OBN'
mkdir -p /root/.ssh
chmod 700 /root/.ssh
grep -qF "$PUBKEY" /root/.ssh/authorized_keys 2>/dev/null || echo "$PUBKEY" >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

cd "$APP_DIR"

echo "==> Docker infra (Postgres :5434, Redis :6380, MinIO :9100)"
export DB_PASSWORD S3_ACCESS_KEY S3_SECRET_KEY
docker compose -f deploy/docker-compose.prod.yml up -d

echo "==> Waiting for Postgres"
for _ in $(seq 1 40); do
  if docker compose -f deploy/docker-compose.prod.yml exec -T postgres pg_isready -U gotcha -d gotcha &>/dev/null; then
    break
  fi
  sleep 2
done

echo "==> Root .env for API/worker"
cat >"${APP_DIR}/.env" <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://gotcha:${DB_PASSWORD}@127.0.0.1:5434/gotcha?schema=public
REDIS_URL=redis://127.0.0.1:6380
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-15m}
JWT_REFRESH_EXPIRES_IN=${JWT_REFRESH_EXPIRES_IN:-30d}
S3_ENDPOINT=http://127.0.0.1:9100
S3_ACCESS_KEY=${S3_ACCESS_KEY}
S3_SECRET_KEY=${S3_SECRET_KEY}
S3_BUCKET=${S3_BUCKET:-gotcha-content}
S3_REGION=${S3_REGION:-us-east-1}
S3_FORCE_PATH_STYLE=true
UPLOADS_DIR=${APP_DIR}/uploads
OPENAI_API_KEY=${OPENAI_API_KEY:-}
OPENAI_MODEL_LOOKUP=${OPENAI_MODEL_LOOKUP:-gpt-4.1-mini}
OPENAI_MODEL_QUIZ=${OPENAI_MODEL_QUIZ:-gpt-4.1-mini}
API_PORT=3200
API_CORS_ORIGINS=https://${DOMAIN},https://www.${DOMAIN}
DEV_AUTH_ANY_CREDENTIAL=false
DEV_UNLIMITED_IMPORTS=false
WORKER_CONCURRENCY=${WORKER_CONCURRENCY:-5}
EOF
chmod 600 "${APP_DIR}/.env"
mkdir -p "${APP_DIR}/uploads"
ln -sfn "${APP_DIR}/.env" "${APP_DIR}/services/api/.env"
ln -sfn "${APP_DIR}/.env" "${APP_DIR}/services/worker/.env"

echo "==> npm install + build"
# Strip BOM/CRLF that can break tsc emit / shell scripts from Windows packs
find "$APP_DIR" -type f \( -name '*.json' -o -name '*.sh' -o -name '*.cjs' -o -name '*.yml' \) \
  -not -path '*/node_modules/*' -print0 \
  | xargs -0 -r sed -i '1s/^\xEF\xBB\xBF//;s/\r$//' || true

npm ci
npm run build --workspace=packages/shared
npm run db:generate
# nest/tsc write tsconfig.build.tsbuildinfo — stale info can skip JS emit
rm -rf services/api/dist services/worker/dist
rm -f services/api/*.tsbuildinfo services/worker/*.tsbuildinfo
npm run build --workspace=services/api
test -f services/api/dist/main.js || {
  echo "API build missing dist/main.js — falling back to tsc"
  (cd services/api && npx tsc -p tsconfig.build.json --incremental false)
  test -f services/api/dist/main.js
}
npm run build --workspace=services/worker
test -f services/worker/dist/index.js

# Strip BOM from migrations if present
find services/api/prisma/migrations -name '*.sql' -exec sed -i '1s/^\xEF\xBB\xBF//' {} + 2>/dev/null || true

echo "==> Prisma migrate + seed"
cd services/api
npx prisma migrate deploy
npm run db:seed || true
cd "$APP_DIR"

echo "==> Build frontends (path-based on one domain)"
# shellcheck source=lib/vite-env.sh
source "${APP_DIR}/deploy/lib/vite-env.sh"
build_and_publish_frontends

echo "==> PM2"
VPS_APP_DIR="$APP_DIR" pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true

echo "==> Nginx"
sed "s/__DOMAIN__/${DOMAIN}/g" deploy/nginx/gotcha.conf > "/etc/nginx/sites-available/gotcha"
ln -sf /etc/nginx/sites-available/gotcha /etc/nginx/sites-enabled/gotcha
nginx -t
systemctl reload nginx

if [[ "$SKIP_SSL" != "1" ]]; then
  echo "==> HTTPS (Let's Encrypt)"
  certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" \
    --non-interactive --agree-tos -m "$CERTBOT_EMAIL" --redirect || {
    echo "WARN: certbot failed — HTTP may still work until DNS/ports are ready"
  }
fi

echo ""
echo "=============================================="
echo " Gotcha deployed on Eskiz VPS2 (single host)"
echo " Marketing: https://${DOMAIN}/"
echo " Learner:   https://${DOMAIN}/learn/"
echo " Admin:     https://${DOMAIN}/admin/"
echo " API:       https://${DOMAIN}/api/v1"
echo " Docs:      https://${DOMAIN}/api/docs"
echo "=============================================="
