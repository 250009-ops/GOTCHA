#!/usr/bin/env bash
# Redeploy Gotcha after syncing new code to the VPS.
set -euo pipefail

APP_DIR="${VPS_APP_DIR:-/var/www/gotcha}"
cd "$APP_DIR"

get_env() {
  local key="$1"
  local line
  line="$(grep -E "^${key}=" "${APP_DIR}/deploy/.env" | head -1 || true)"
  printf '%s' "${line#*=}"
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
ADMIN_APP_URL="$(get_env VITE_ADMIN_APP_URL)"
ADMIN_APP_URL="${ADMIN_APP_URL:-https://${DOMAIN}/admin}"
SMTP_HOST="$(get_env SMTP_HOST)"
SMTP_PORT="$(get_env SMTP_PORT)"
SMTP_SECURE="$(get_env SMTP_SECURE)"
SMTP_USER="$(get_env SMTP_USER)"
SMTP_PASS="$(get_env SMTP_PASS)"
SMTP_FROM="$(get_env SMTP_FROM)"
SMTP_REPLY_TO="$(get_env SMTP_REPLY_TO)"

sync_runtime_env_key LEARNER_APP_URL "${LEARNER_APP_URL}"
sync_runtime_env_key ADMIN_APP_URL "${ADMIN_APP_URL}"
sync_runtime_env_key API_PORT "${API_PORT:-3200}"
sync_runtime_env_key API_CORS_ORIGINS "$(get_env API_CORS_ORIGINS)"
sync_runtime_env_key OPENAI_API_KEY "$(get_env OPENAI_API_KEY)"
sync_runtime_env_key OPENAI_MODEL_LOOKUP "$(get_env OPENAI_MODEL_LOOKUP)"
sync_runtime_env_key OPENAI_MODEL_QUIZ "$(get_env OPENAI_MODEL_QUIZ)"
sync_runtime_env_key OPENAI_MODEL_IMPORT "$(get_env OPENAI_MODEL_IMPORT)"
sync_runtime_env_key OPENAI_MODEL_TTS "$(get_env OPENAI_MODEL_TTS)"
sync_runtime_env_key IMPORT_AI_CLEANUP_ENABLED "$(get_env IMPORT_AI_CLEANUP_ENABLED)"
sync_runtime_env_key DEV_AUTH_ANY_CREDENTIAL "$(get_env DEV_AUTH_ANY_CREDENTIAL)"
sync_runtime_env_key DEV_UNLIMITED_IMPORTS "$(get_env DEV_UNLIMITED_IMPORTS)"
sync_runtime_env_key IMPORTS_UNLIMITED "$(get_env IMPORTS_UNLIMITED)"
sync_runtime_env_key PAYMENT_GATEWAY_ENABLED "$(get_env PAYMENT_GATEWAY_ENABLED)"
sync_runtime_env_key ATMOS_CONSUMER_KEY "$(get_env ATMOS_CONSUMER_KEY)"
sync_runtime_env_key ATMOS_CONSUMER_SECRET "$(get_env ATMOS_CONSUMER_SECRET)"
sync_runtime_env_key ATMOS_STORE_ID "$(get_env ATMOS_STORE_ID)"
sync_runtime_env_key ATMOS_API_KEY "$(get_env ATMOS_API_KEY)"
sync_runtime_env_key ATMOS_API_BASE "$(get_env ATMOS_API_BASE)"
sync_runtime_env_key ATMOS_IKPU "$(get_env ATMOS_IKPU)"
sync_runtime_env_key ATMOS_MIN_AMOUNT_SOM "$(get_env ATMOS_MIN_AMOUNT_SOM)"
sync_runtime_env_key ATMOS_MERCHANT_TIN "$(get_env ATMOS_MERCHANT_TIN)"
sync_runtime_env_key SMTP_HOST "${SMTP_HOST}"
sync_runtime_env_key SMTP_PORT "${SMTP_PORT:-465}"
sync_runtime_env_key SMTP_SECURE "${SMTP_SECURE:-true}"
sync_runtime_env_key SMTP_USER "${SMTP_USER}"
sync_runtime_env_key SMTP_PASS "${SMTP_PASS}"
sync_runtime_env_key SMTP_FROM "${SMTP_FROM:-GOTCHA <noreply@${DOMAIN}>}"
sync_runtime_env_key SMTP_REPLY_TO "${SMTP_REPLY_TO}"
for tg_key in TELEGRAM_BOT_TOKEN TELEGRAM_BOT_USERNAME TELEGRAM_WEBHOOK_SECRET TELEGRAM_MINI_APP_URL; do
  tg_val="$(get_env "$tg_key")"
  if [[ -n "$tg_val" ]]; then
    sync_runtime_env_key "$tg_key" "$tg_val"
  fi
done
if [[ -z "$(get_env TELEGRAM_MINI_APP_URL)" ]]; then
  sync_runtime_env_key TELEGRAM_MINI_APP_URL "https://${DOMAIN}/tg"
fi
sync_runtime_env_key TELEGRAM_WEBHOOK_URL "https://${DOMAIN}/api/v1/telegram/webhook"

# Defaults if deploy/.env omitted optional keys
if [[ -z "$(get_env API_CORS_ORIGINS)" ]]; then
  sync_runtime_env_key API_CORS_ORIGINS "https://${DOMAIN},https://www.${DOMAIN}"
fi
sync_runtime_env_key ENABLE_SWAGGER "false"
if [[ -z "$(get_env DEV_AUTH_ANY_CREDENTIAL)" ]]; then
  sync_runtime_env_key DEV_AUTH_ANY_CREDENTIAL "false"
fi
if [[ -z "$(get_env DEV_UNLIMITED_IMPORTS)" ]]; then
  sync_runtime_env_key DEV_UNLIMITED_IMPORTS "false"
fi
if [[ -z "$(get_env OPENAI_MODEL_LOOKUP)" ]]; then
  sync_runtime_env_key OPENAI_MODEL_LOOKUP "gpt-4.1-mini"
fi
if [[ -z "$(get_env OPENAI_MODEL_QUIZ)" ]]; then
  sync_runtime_env_key OPENAI_MODEL_QUIZ "gpt-4.1-mini"
fi
if [[ -z "$(get_env OPENAI_MODEL_IMPORT)" ]]; then
  sync_runtime_env_key OPENAI_MODEL_IMPORT "gpt-4.1-mini"
fi
if [[ -z "$(get_env IMPORT_AI_CLEANUP_ENABLED)" ]]; then
  sync_runtime_env_key IMPORT_AI_CLEANUP_ENABLED "true"
fi

# Strip CRLF that can break shell scripts uploaded from Windows
find "$APP_DIR/deploy" -type f \( -name '*.sh' -o -name '*.cjs' -o -name '*.yml' \) \
  -print0 | xargs -0 -r sed -i '1s/^\xEF\xBB\xBF//;s/\r$//' || true

ln -sfn "${APP_DIR}/.env" "${APP_DIR}/services/api/.env"
ln -sfn "${APP_DIR}/.env" "${APP_DIR}/services/worker/.env"

# Native tesseract is ~5–10× faster than WASM for scanned PDFs.
echo "==> Ensuring tesseract-ocr"
export DEBIAN_FRONTEND=noninteractive
tess_need=0
for tess_pkg in tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus \
  tesseract-ocr-fra tesseract-ocr-deu tesseract-ocr-spa tesseract-ocr-por; do
  dpkg -s "$tess_pkg" >/dev/null 2>&1 || tess_need=1
done
if [[ "$tess_need" -eq 1 ]]; then
  apt-get update -qq
  apt-get install -y -qq tesseract-ocr tesseract-ocr-eng tesseract-ocr-rus \
    tesseract-ocr-fra tesseract-ocr-deu tesseract-ocr-spa tesseract-ocr-por
fi

docker compose -f deploy/docker-compose.prod.yml up -d

npm ci
npm run build --workspace=packages/shared --if-present
npm run db:generate
rm -rf services/api/dist services/worker/dist
rm -f services/api/*.tsbuildinfo services/worker/*.tsbuildinfo
npm run build --workspace=services/api
test -f services/api/dist/main.js
node -e "const fs=require('fs'); const rev=fs.existsSync('deploy/LOCAL_REV')?fs.readFileSync('deploy/LOCAL_REV','utf8').trim().slice(0,12):'dev'; fs.writeFileSync('services/api/dist/build-info.json', JSON.stringify({sha:rev, date:new Date().toISOString().slice(0,10)}));"
npm run build --workspace=services/worker
cd services/api && npx prisma migrate deploy && cd "$APP_DIR"

# shellcheck source=lib/vite-env.sh
source "${APP_DIR}/deploy/lib/vite-env.sh"
build_and_publish_frontends

VPS_APP_DIR="$APP_DIR" pm2 startOrReload deploy/ecosystem.config.cjs --update-env
pm2 save

# Refresh app routes without stripping Certbot SSL (prior deploys overwrote listen 443).
sed "s/__DOMAIN__/${DOMAIN}/g" deploy/nginx/gotcha.conf > "/etc/nginx/sites-available/gotcha"
ln -sf /etc/nginx/sites-available/gotcha /etc/nginx/sites-enabled/gotcha
nginx -t && systemctl reload nginx
if [[ -d "/etc/letsencrypt/live/${DOMAIN}" ]]; then
  # CRITICAL: Do NOT swallow certbot failures — silent SSL failure causes login 500s.
  # Try install first (fast, uses existing cert); fall back to full renewal if needed.
  if ! certbot install --cert-name "${DOMAIN}" --nginx --non-interactive --redirect; then
    echo "certbot install failed, attempting full renewal..."
    certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos \
      -m "admin@${DOMAIN}" --redirect --reinstall
  fi
  nginx -t && systemctl reload nginx
fi

if [[ -n "$(get_env TELEGRAM_BOT_TOKEN)" && -n "$(get_env TELEGRAM_WEBHOOK_SECRET)" ]]; then
  echo "==> Telegram webhook"
  DOMAIN="$DOMAIN" node services/api/scripts/register-telegram-webhook.mjs || echo "WARN: telegram webhook registration failed"
fi

echo "Update complete: https://${DOMAIN}/"
