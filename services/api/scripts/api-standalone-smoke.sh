#!/usr/bin/env bash
# final-5.1: clean-room smoke for the API dist tgz. Fails if a runtime dep is missing.
# Extracts the tgz into a fresh temp dir (no parent node_modules), runs `npm ci --omit=dev`,
# applies migrations to a throwaway Postgres it starts itself, boots `node dist/main.js`
# with NODE_ENV=production and dummy local-only secrets, checks routes, greps the log for
# module-not-found, then stops only the PIDs it started and deletes the temp dir.
# Usage: api-standalone-smoke.sh <api-dist.tgz> [log-out]
set -euo pipefail
TGZ="$(readlink -f "$1")"; LOGOUT="${2:-}"
PGBIN="${PGBIN:-$(dirname "$(command -v initdb || ls /usr/lib/postgresql/*/bin/initdb /workspace/gotcha-staging/pg17/bin/initdb 2>/dev/null | head -1)")}"; [[ -x "$PGBIN/initdb" ]] || { echo "ABORT: set PGBIN to a dir with initdb/pg_ctl"; exit 2; }
PGPORT="${SMOKE_PG_PORT:-55491}"; PORT="${SMOKE_API_PORT:-3291}"
W="$(mktemp -d /tmp/f51-smoke.XXXXXX)"; APIPID=""
cleanup(){ [[ -n "$APIPID" ]] && kill "$APIPID" 2>/dev/null || true
  [[ -d "$W/pg" ]] && "$PGBIN/pg_ctl" -D "$W/pg" stop -m fast >/dev/null 2>&1 || true
  [[ -n "$LOGOUT" && -f "$W/report.txt" ]] && cp "$W/report.txt" "$LOGOUT"; rm -rf "$W"; }
trap cleanup EXIT
R="$W/report.txt"; say(){ echo "$*" | tee -a "$R"; }
fail(){ say "FAIL: $*"; [[ -f "$W/app.log" ]] && tail -30 "$W/app.log" | tee -a "$R"; exit 1; }
# Node/npm steps run in a private mount namespace where /node_modules (a box-wide dir, not ours) is masked
# by an empty tmpfs, so nothing above the app dir can satisfy a require. Nothing outside is changed.
iso(){ if [[ -e /node_modules ]]; then exec unshare -rm sh -c 'mount -t tmpfs none /node_modules && exec "$@"' sh "$@"; else exec "$@"; fi; }  # always call in a ( subshell )
d="$W"; while [[ "$d" != "/" ]]; do d="$(dirname "$d")"; [[ "$d" != "/" && -e "$d/node_modules" ]] && fail "parent $d/node_modules exists"; done
[[ -e /node_modules ]] && say "note: /node_modules masked with empty tmpfs for npm/node steps" && { ( iso sh -c '[ -z "$(ls -A /node_modules)" ]' ) || fail "mask failed"; }
mkdir "$W/app" && tar -xzf "$TGZ" -C "$W/app"
for f in package.json package-lock.json dist/main.js prisma/schema.prisma vendor/gotcha-shared/package.json; do [[ -f "$W/app/$f" ]] || fail "tgz lacks $f"; done
say "tgz: $(basename "$TGZ") $(sha256sum "$TGZ" | cut -c1-16)"
( cd "$W/app" && iso env -i PATH="$PATH" HOME="$W/home" npm_config_cache="$W/npm-cache" npm ci --omit=dev --no-audit --no-fund ) > "$W/npm.log" 2>&1 || { tail -20 "$W/npm.log" | tee -a "$R"; fail "npm ci --omit=dev"; }
say "npm ci --omit=dev: OK ($(grep -oE 'added [0-9]+ packages' "$W/npm.log" | head -1))"
for dd in @nestjs/cli @nestjs/schematics ts-node; do [[ -d "$W/app/node_modules/$dd" ]] && fail "dev dep $dd installed"; done; true
"$PGBIN/initdb" -D "$W/pg" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$W/pg" -o "-p $PGPORT -k $W -c listen_addresses=127.0.0.1" -l "$W/pg.log" start >/dev/null
psql -q -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -c "CREATE DATABASE f51smoke" >/dev/null
DB="postgresql://postgres@127.0.0.1:$PGPORT/f51smoke"
( cd "$W/app" && iso env -i PATH="$PATH" HOME="$W/home" DATABASE_URL="$DB" npx --no-install prisma migrate deploy ) > "$W/mig.log" 2>&1 || { tail -20 "$W/mig.log" | tee -a "$R"; fail "migrate deploy"; }
say "prisma migrate deploy: $(grep -cE '^Applying migration' "$W/mig.log") migrations applied"
( cd "$W/app" && iso env -i PATH="$PATH" HOME="$W/home" NODE_ENV=production API_PORT="$PORT" PORT="$PORT" DATABASE_URL="$DB" \
  JWT_SECRET=smoke-only-secret-xxxxxxxxxxxxxxxxxxxxxxxxxx JWT_REFRESH_SECRET=smoke-only-refresh-xxxxxxxxxxxxxxxxxxxx \
  ADMIN_APP_URL=https://gotchaa.uz/admin PAYMENT_GATEWAY_ENABLED=true WEB_PLUS_PASS=true \
  UPLOADS_DIR="$W/uploads" API_CORS_ORIGINS=https://gotchaa.uz node dist/main.js ) > "$W/app.log" 2>&1 &
APIPID=$!
for i in $(seq 1 60); do curl -fs "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1 && break; kill -0 $APIPID 2>/dev/null || fail "API exited during boot"; sleep 0.5; done
chk(){ local exp="$1" m="$2" p="$3" body="${4:-}"; local c
  if [[ -n "$body" ]]; then c=$(curl -s -o "$W/r" -w '%{http_code}' -X "$m" -H 'content-type: application/json' -d "$body" "http://127.0.0.1:$PORT/api/v1$p")
  else c=$(curl -s -o "$W/r" -w '%{http_code}' -X "$m" "http://127.0.0.1:$PORT/api/v1$p"); fi
  [[ "$c" == "$exp" ]] && say "PASS $m $p -> $c $(head -c 80 "$W/r")" || fail "$m $p expected $exp got $c $(head -c 200 "$W/r")"; }
chk 200 GET /health
chk 200 GET /content/languages
chk 200 GET /billing/plans
chk 200 GET /billing/gateway-status
grep -q '"paymentGatewayEnabled":true' "$W/r" && say "PASS payments ON: gateway-status paymentGatewayEnabled=true (PAYMENT_GATEWAY_ENABLED=true only)" || fail "gateway-status not ON with PAYMENT_GATEWAY_ENABLED=true"
chk 401 GET /users/me
# final-6.1: practice engine routes exist (401 unauthenticated, never 404)
chk 401 GET /practice/overview
chk 401 GET /practice/forecast
chk 401 GET /practice/daily
chk 401 POST /practice/answer '{}'
chk 401 POST /practice/audio '{}'
chk 401 POST /practice/daily/00000000-0000-0000-0000-000000000000/complete
chk 401 GET /practice/sessions/00000000-0000-0000-0000-000000000000
chk 200 GET /health/version
grep -q '"sha"' "$W/r" && say "PASS S4 build id: $(head -c 80 "$W/r")" || fail "health/version lacks sha"
chk 410 GET /marketing/landing   # WLF-35 retired
chk 200 GET /billing/plans
grep -q '"priceMonthly":24990' "$W/r" && grep -q '"priceHidden":false' "$W/r" && ! grep -q 'pages of imports a day' "$W/r" && say "PASS Kai 6.1a: Plus 24990 shown, pages a month" || fail "billing/plans price/cycle"
chk 200 GET '/marketing/plans?lang=en'
grep -q '"priceMonthly":24990' "$W/r" && say "PASS marketing/plans Plus 24990" || fail "marketing/plans lacks Plus 24990"
chk 401 POST /auth/login '{"email":"nobody@example.com","password":"wrong-password-123"}'
sleep 1; kill -0 $APIPID 2>/dev/null || fail "API died after requests"
if grep -nE "Cannot find module|MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND" "$W/app.log" "$W/npm.log" "$W/mig.log" | tee -a "$R"; then fail "module-not-found in logs"; fi
say "grep module-not-found: none"
say "API_STANDALONE_SMOKE OK"
