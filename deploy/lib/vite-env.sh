# Shared Vite production env for frontend builds.
# Sourced by install.sh / update.sh. Requires get_env + DOMAIN.

load_vite_build_env() {
  local api web marketing learner admin
  api="$(get_env VITE_API_URL)"
  web="$(get_env VITE_WEB_URL)"
  marketing="$(get_env VITE_MARKETING_URL)"
  learner="$(get_env VITE_LEARNER_APP_URL)"
  admin="$(get_env VITE_ADMIN_APP_URL)"

  export VITE_API_URL="${api:-https://${DOMAIN}/api/v1}"
  export VITE_WEB_URL="${web:-https://${DOMAIN}}"
  export VITE_MARKETING_URL="${marketing:-https://${DOMAIN}}"
  export VITE_LEARNER_APP_URL="${learner:-https://${DOMAIN}/learn}"
  export VITE_ADMIN_APP_URL="${admin:-https://${DOMAIN}/admin}"

  if [[ -z "${VITE_API_URL}" || "${VITE_API_URL}" == *"localhost"* || "${VITE_API_URL}" == *"127.0.0.1"* ]]; then
    echo "ERROR: VITE_API_URL must be a public production URL (got: '${VITE_API_URL}')"
    echo "Set VITE_API_URL=https://${DOMAIN}/api/v1 in deploy/.env"
    exit 1
  fi

  echo "==> Vite build env: VITE_API_URL=${VITE_API_URL}"
  echo "==> Vite build env: VITE_LEARNER_APP_URL=${VITE_LEARNER_APP_URL}"
  echo "==> Vite build env: VITE_ADMIN_APP_URL=${VITE_ADMIN_APP_URL}"
}

build_and_publish_frontends() {
  load_vite_build_env

  VITE_BASE=/ npm run build --workspace=apps/web
  VITE_BASE=/learn/ npm run build --workspace=apps/web-learner
  VITE_BASE=/admin/ npm run build --workspace=apps/admin

  rm -rf "${APP_DIR}/public"
  mkdir -p "${APP_DIR}/public/learn" "${APP_DIR}/public/admin"
  cp -a apps/web/dist/. "${APP_DIR}/public/"
  cp -a apps/web-learner/dist/. "${APP_DIR}/public/learn/"
  cp -a apps/admin/dist/. "${APP_DIR}/public/admin/"
}
