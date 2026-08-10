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
if [[ -z "${DOMAIN}" || "${DOMAIN}" == "YOUR_DOMAIN" ]]; then
  echo "Set DOMAIN in deploy/.env before update"
  exit 1
fi

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

# shellcheck source=lib/vite-env.sh
source "${APP_DIR}/deploy/lib/vite-env.sh"
build_and_publish_frontends

VPS_APP_DIR="$APP_DIR" pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

sed "s/__DOMAIN__/${DOMAIN}/g" deploy/nginx/gotcha.conf > "/etc/nginx/sites-available/gotcha"
ln -sf /etc/nginx/sites-available/gotcha /etc/nginx/sites-enabled/gotcha
nginx -t && systemctl reload nginx

echo "Update complete: https://${DOMAIN}/"
