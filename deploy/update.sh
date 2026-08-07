#!/usr/bin/env bash
# Redeploy Gotcha after syncing new code to the VPS.
set -euo pipefail

APP_DIR="${VPS_APP_DIR:-/var/www/gotcha}"
cd "$APP_DIR"

get_env() {
  local key="$1"
  grep -E "^${key}=" "${APP_DIR}/deploy/.env" | head -1 | cut -d= -f2-
}

DOMAIN="${DOMAIN:-$(get_env DOMAIN)}"
DOMAIN="${DOMAIN:-vps10094.eskiz.uz}"
export DB_PASSWORD="$(get_env DB_PASSWORD)"
export S3_ACCESS_KEY="$(get_env S3_ACCESS_KEY)"
export S3_SECRET_KEY="$(get_env S3_SECRET_KEY)"
S3_ACCESS_KEY="${S3_ACCESS_KEY:-gotcha}"
export S3_ACCESS_KEY

docker compose -f deploy/docker-compose.prod.yml up -d

npm ci
npm run db:generate
npm run build --workspace=services/api
npm run build --workspace=services/worker
cd services/api && npx prisma migrate deploy && cd "$APP_DIR"

export VITE_API_URL="https://${DOMAIN}/api/v1"
export VITE_WEB_URL="https://${DOMAIN}"
export VITE_MARKETING_URL="https://${DOMAIN}"
export VITE_LEARNER_APP_URL="https://${DOMAIN}/learn"
export VITE_ADMIN_APP_URL="https://${DOMAIN}/admin"

VITE_BASE=/ npm run build --workspace=apps/web
VITE_BASE=/learn/ npm run build --workspace=apps/web-learner
VITE_BASE=/admin/ npm run build --workspace=apps/admin

rm -rf "${APP_DIR}/public"
mkdir -p "${APP_DIR}/public/learn" "${APP_DIR}/public/admin"
cp -a apps/web/dist/. "${APP_DIR}/public/"
cp -a apps/web-learner/dist/. "${APP_DIR}/public/learn/"
cp -a apps/admin/dist/. "${APP_DIR}/public/admin/"

VPS_APP_DIR="$APP_DIR" pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

sed "s/__DOMAIN__/${DOMAIN}/g" deploy/nginx/gotcha.conf > "/etc/nginx/sites-available/gotcha"
ln -sf /etc/nginx/sites-available/gotcha /etc/nginx/sites-enabled/gotcha
nginx -t && systemctl reload nginx

echo "Update complete: https://${DOMAIN}/"
