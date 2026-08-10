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

# Keep runtime .env in sync for SMTP + learner links (PM2 reads services/api/.env → APP_DIR/.env)
# Uses awk so values with *, ?, &, etc. (mailbox passwords) are safe.
sync_runtime_env_key() {
  local key="$1"
  local value="$2"
  local file="${APP_DIR}/.env"
  local tmp
  touch "$file"
  tmp="$(mktemp)"
  KEY="$key" VAL="$value" awk '
    BEGIN { k=ENVIRON["KEY"]; v=ENVIRON["VAL"]; done=0 }
    index($0, k "=") == 1 { print k "=" v; done=1; next }
    { print }
    END { if (!done) print k "=" v }
  ' "$file" >"$tmp"
  mv "$tmp" "$file"
}

LEARNER_APP_URL="$(get_env LEARNER_APP_URL)"
LEARNER_APP_URL="${LEARNER_APP_URL:-https://${DOMAIN}/learn}"
SMTP_HOST="$(get_env SMTP_HOST)"
SMTP_PORT="$(get_env SMTP_PORT)"
SMTP_SECURE="$(get_env SMTP_SECURE)"
SMTP_USER="$(get_env SMTP_USER)"
SMTP_PASS="$(get_env SMTP_PASS)"
SMTP_FROM="$(get_env SMTP_FROM)"
SMTP_REPLY_TO="$(get_env SMTP_REPLY_TO)"

sync_runtime_env_key LEARNER_APP_URL "${LEARNER_APP_URL}"
sync_runtime_env_key SMTP_HOST "${SMTP_HOST}"
sync_runtime_env_key SMTP_PORT "${SMTP_PORT:-465}"
sync_runtime_env_key SMTP_SECURE "${SMTP_SECURE:-true}"
sync_runtime_env_key SMTP_USER "${SMTP_USER}"
sync_runtime_env_key SMTP_PASS "${SMTP_PASS}"
sync_runtime_env_key SMTP_FROM "${SMTP_FROM:-GOTCHA <noreply@${DOMAIN}>}"
sync_runtime_env_key SMTP_REPLY_TO "${SMTP_REPLY_TO}"

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
