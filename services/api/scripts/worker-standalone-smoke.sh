#!/usr/bin/env bash
# final-6.1b: clean-room smoke for the Postgres import-queue worker (dist/worker.js) from the API dist tgz.
# Fresh temp dir, `npm ci --omit=dev`, throwaway Postgres (PGBIN, use PG16 to match prod), migrate deploy,
# boot dist/main.js (no in-process worker), then:
#   E2E: register → paste ×3 via the API while NO worker runs → rows queued, attempts 0, locked_by NULL (= prod's stuck rows)
#   stale lock: a 'running' row owned by a dead worker (old heartbeat) → reclaimed and processed
#   failure: a paid import whose source is gone (max_attempts 1) → failed, refund_state 'due', no new charge; a failed
#            free paste does not count against the 3/day + 50 pages free pool
#   2 workers at once: every job claimed exactly once; done → readable document (GET /content/:id/segments)
#   SIGTERM: both workers exit 0 with "import worker stopped"
# Kills only the PIDs it started, removes its temp dir. Usage: worker-standalone-smoke.sh <api-dist.tgz> [log-out]
set -euo pipefail
TGZ="$(readlink -f "$1")"; LOGOUT="${2:-}"
PGBIN="${PGBIN:?set PGBIN to a PG16 bin dir with initdb/pg_ctl}"; [[ -x "$PGBIN/initdb" ]] || { echo "ABORT: bad PGBIN"; exit 2; }
PGPORT="${SMOKE_PG_PORT:-55493}"; PORT="${SMOKE_API_PORT:-3293}"
W="$(mktemp -d /tmp/f61b-wsmoke.XXXXXX)"; APIPID=""; W1=""; W2=""
cleanup(){ for p in $W1 $W2 $APIPID; do kill "$p" 2>/dev/null || true; done; sleep 0.5
  [[ -d "$W/pg" ]] && "$PGBIN/pg_ctl" -D "$W/pg" stop -m fast >/dev/null 2>&1 || true
  [[ -n "$LOGOUT" && -f "$W/report.txt" ]] && cp "$W/report.txt" "$LOGOUT"; rm -rf "$W"; }
trap cleanup EXIT
R="$W/report.txt"; say(){ echo "$*" | tee -a "$R"; }
fail(){ say "FAIL: $*"; for f in app w1 w2; do [[ -f "$W/$f.log" ]] && { say "--- $f.log"; tail -25 "$W/$f.log" | tee -a "$R"; }; done; exit 1; }
iso(){ if [[ -e /node_modules ]]; then exec unshare -rm sh -c 'mount -t tmpfs none /node_modules && exec "$@"' sh "$@"; else exec "$@"; fi; }
mkdir "$W/app" && tar -xzf "$TGZ" -C "$W/app"
for f in package.json package-lock.json dist/main.js dist/worker.js prisma/schema.prisma; do [[ -f "$W/app/$f" ]] || fail "tgz lacks $f"; done
say "tgz: $(basename "$TGZ") $(sha256sum "$TGZ" | cut -c1-16); dist/worker.js present"
( cd "$W/app" && iso env -i PATH="$PATH" HOME="$W/home" npm_config_cache="$W/npm-cache" npm ci --omit=dev --no-audit --no-fund ) > "$W/npm.log" 2>&1 || fail "npm ci --omit=dev"
say "npm ci --omit=dev: OK"
"$PGBIN/initdb" -D "$W/pg" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$W/pg" -o "-p $PGPORT -k $W -c listen_addresses=127.0.0.1" -l "$W/pg.log" -w start >/dev/null
Q(){ psql -X -qAt -h 127.0.0.1 -p "$PGPORT" -U postgres -d wsmoke -c "$1"; }
psql -q -h 127.0.0.1 -p "$PGPORT" -U postgres -d postgres -c "CREATE DATABASE wsmoke" >/dev/null
say "postgres: $(Q 'show server_version')"
DB="postgresql://postgres@127.0.0.1:$PGPORT/wsmoke"
( cd "$W/app" && iso env -i PATH="$PATH" HOME="$W/home" DATABASE_URL="$DB" npx --no-install prisma migrate deploy ) > "$W/mig.log" 2>&1 || fail "migrate deploy"
say "migrate deploy: $(grep -cE '^Applying migration' "$W/mig.log") migrations"
ENVV=(PATH="$PATH" HOME="$W/home" NODE_ENV=production DATABASE_URL="$DB" UPLOADS_DIR="$W/uploads" IMPORT_WORKER_IN_API=false PAYMENT_GATEWAY_ENABLED=true IMPORT_WORKER_DRAIN_MS=3000)
( cd "$W/app" && iso env -i "${ENVV[@]}" API_PORT="$PORT" PORT="$PORT" JWT_SECRET=smoke-only-secret-xxxxxxxxxxxxxxxxxxxxxxxxxx \
  JWT_REFRESH_SECRET=smoke-only-refresh-xxxxxxxxxxxxxxxxxxxx ADMIN_APP_URL=https://gotchaa.uz/admin WEB_PLUS_PASS=true API_CORS_ORIGINS=https://gotchaa.uz node dist/main.js ) > "$W/app.log" 2>&1 &
APIPID=$!
for i in $(seq 1 60); do curl -fs "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1 && break; kill -0 $APIPID 2>/dev/null || fail "API exited"; sleep 0.5; done
B="http://127.0.0.1:$PORT/api/v1"; EM="wsmoke-$$@example.test"; PW="Ws-$(head -c 6 /dev/urandom | od -An -tx1 | tr -d ' \n')A1"
curl -s -o /dev/null -X POST "$B/auth/register" -H 'content-type: application/json' -d "{\"email\":\"$EM\",\"password\":\"$PW\",\"displayName\":\"WS\",\"nativeLanguage\":\"uz\",\"targetLanguages\":[\"en\"],\"acceptTerms\":true,\"clientPlatform\":\"web\"}"
Q "update users set email_verified_at=now() where email='$EM'" >/dev/null
TOK=$(curl -s -X POST "$B/auth/login" -H 'content-type: application/json' -d "{\"email\":\"$EM\",\"password\":\"$PW\"}" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("accessToken",""))')
[[ -n "$TOK" ]] || fail "login"
UID_=$(Q "select id from users where email='$EM'")
TXT=$(python3 -c 'print(" ".join(["The quick brown fox jumps over the lazy dog near the river bank today."]*12))')
paste(){ local pid; pid=$(curl -s -X POST "$B/billing/imports/checkout" -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d "{\"importType\":\"paste\",\"contentFormat\":\"article\",\"textLength\":${#TXT},\"platform\":\"web\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("paymentId") if d.get("isFree") else json.dumps(d)[:300])')
  [[ "$pid" =~ ^[0-9a-f-]{36}$ ]] || { echo "free checkout: $pid"; return; }
  curl -s -X POST "$B/imports/paste" -H "authorization: Bearer $TOK" -H 'content-type: application/json' \
  -d "{\"title\":\"$1\",\"text\":\"$TXT\",\"language\":\"en\",\"paymentId\":\"$pid\"}" | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("id") or json.dumps(d)[:300])'; }
P1=$(paste "Stuck one"); P2=$(paste "Stuck two"); P3=$(paste "Will fail free")
for p in $P1 $P2 $P3; do [[ "$p" =~ ^[0-9a-f-]{36}$ ]] || fail "paste returned $p"; done
say "E2E paste ×3 via API (no worker running): $(Q "select string_agg(status||'/'||attempts||'/'||coalesce(locked_by,'null'),' ') from import_queue_jobs")"
[[ "$(Q "select count(*) from import_queue_jobs where status='queued' and attempts=0 and locked_by is null")" == 3 ]] || fail "rows not queued/0/null"
FREE0=$(Q "select count(*) from import_payments where user_id='$UID_' and amount_tiyins=0 and status='paid'")
say "free credits recorded by the API for the 3 pastes: $FREE0"
# failure (free): source text deleted, single attempt
K3=$(Q "select payload->>'textKey' from import_queue_jobs where user_import_id='$P3'"); rm -f "$W/uploads/$K3"
Q "update import_queue_jobs set max_attempts=1 where user_import_id='$P3'" >/dev/null
# failure (paid): import with a paid 5 000 so'm payment, source missing, single attempt
P4=$(Q "insert into user_imports(id,user_id,title,import_type,language,ingestion_status,file_key) values (gen_random_uuid(),'$UID_','Paid will fail','paste','en','queued','imports/missing.txt') returning id" | head -1)
Q "insert into import_payments(id,user_id,status,import_type,content_format,estimated_pages,amount_tiyins,account,user_import_id,paid_at,provider_payment_id) values (gen_random_uuid(),'$UID_','paid','paste','article',1,500000,'wsmoke-$$','$P4',now(),'0')" >/dev/null
Q "insert into import_queue_jobs(id,user_import_id,kind,payload,max_attempts,run_after,updated_at) values (gen_random_uuid(),'$P4','paste','{\"textKey\":\"imports/missing.txt\",\"title\":\"x\",\"language\":\"en\"}',1,(now() at time zone 'UTC') - interval '1 second',now())" >/dev/null
# stale lock: running row owned by a dead worker, heartbeat 10 min old
K1=$(Q "select payload->>'textKey' from import_queue_jobs where user_import_id='$P1'"); cp "$W/uploads/$K1" "$W/uploads/$K1.stale"
P5=$(Q "insert into user_imports(id,user_id,title,import_type,language,ingestion_status,file_key) values (gen_random_uuid(),'$UID_','Stale lock','paste','en','processing','$K1.stale') returning id" | head -1)
Q "insert into import_queue_jobs(id,user_import_id,kind,status,attempts,locked_by,locked_at,heartbeat_at,payload,updated_at) values (gen_random_uuid(),'$P5','paste','running',1,'dead-worker:1',(now() at time zone 'UTC') - interval '10 minutes',(now() at time zone 'UTC') - interval '10 minutes','{\"textKey\":\"$K1.stale\",\"title\":\"Stale lock\",\"language\":\"en\"}',now())" >/dev/null
PAYS0=$(Q "select count(*)||':'||coalesce(sum(amount_tiyins),0) from import_payments")
# 2 workers at once
( cd "$W/app" && iso env -i "${ENVV[@]}" node dist/worker.js ) > "$W/w1.log" 2>&1 & W1=$!
( cd "$W/app" && iso env -i "${ENVV[@]}" node dist/worker.js ) > "$W/w2.log" 2>&1 & W2=$!
for i in $(seq 1 120); do
  [[ "$(Q "select count(*) from import_queue_jobs where status in ('queued','running')")" == 0 ]] && break; sleep 1; done
[[ "$(Q "select count(*) from import_queue_jobs where status in ('queued','running')")" == 0 ]] || fail "jobs not drained: $(Q "select string_agg(status||':'||attempts||':'||coalesce(last_error,''),' | ') from import_queue_jobs")"
sleep 2
say "queue after workers: $(Q "select string_agg(u.title||'='||j.status||'/a'||j.attempts,', ' order by u.title) from import_queue_jobs j join user_imports u on u.id=j.user_import_id")"
grep -q 'Queue on start' "$W/w1.log" && say "w1: $(grep -o 'Queue on start.*' "$W/w1.log" | head -1)"
for p in $P1 $P2 $P5; do
  [[ "$(Q "select status||'/'||attempts from import_queue_jobs where user_import_id='$p'")" =~ ^done/ ]] || fail "$p not done"
  CID=$(Q "select content_id from user_imports where id='$p' and ingestion_status='ready'"); [[ -n "$CID" ]] || fail "$p not ready"
  c=$(curl -s -o "$W/seg" -w '%{http_code}' -H "authorization: Bearer $TOK" "$B/content/$CID/segments")
  [[ "$c" == 200 ]] && grep -q 'quick' "$W/seg" || fail "content $CID not readable ($c)"
done
say "PASS e2e + stuck rows + stale lock: 3 imports ready, GET /content/:id/segments 200 with the pasted text"
[[ "$(Q "select attempts from import_queue_jobs where user_import_id='$P1'")$(Q "select attempts from import_queue_jobs where user_import_id='$P2'")" == 11 ]] || fail "stuck rows took >1 attempt"
N=$(cat "$W/w1.log" "$W/w2.log" | grep -c ' ready in ' || true)
[[ "$N" == 3 ]] || fail "expected 3 'ready in' lines across both workers, got $N (duplicate processing?)"
[[ "$(Q "select count(*) from content_items c join user_imports u on u.content_id=c.id where u.user_id='$UID_'")" == 3 ]] || fail "content count"
say "PASS 2 workers: 3 successes processed exactly once (w1 $(grep -c ' ready in ' "$W/w1.log" || true), w2 $(grep -c ' ready in ' "$W/w2.log" || true)), 1 content row each"
grep -q 'Re-queued 1 stalled' "$W/w1.log" "$W/w2.log" && say "PASS stale lock reclaimed by reaper" || fail "no reaper requeue log"
[[ "$(Q "select status from import_queue_jobs where user_import_id='$P3'")$(Q "select ingestion_status from user_imports where id='$P3'")" == failedfailed ]] || fail "free fail path"
[[ "$(Q "select status||'/'||coalesce(refund_state,'-') from import_payments where user_import_id='$P4'")" == paid/due ]] || fail "paid failure not refund-due: $(Q "select status||'/'||coalesce(refund_state,'-') from import_payments where user_import_id='$P4'")"
[[ "$(Q "select count(*)||':'||coalesce(sum(amount_tiyins),0) from import_payments")" == "$PAYS0" ]] || fail "payments changed (new charge?)"
say "PASS failure: paid import → failed, payment refund_state=due (Atmos not configured in smoke → manual-refund fallback; with Atmos configured it auto-reverses, see f61b-r2-refund.test.ts), no new payment/charge ($PAYS0)"
curl -s -H "authorization: Bearer $TOK" "$B/imports" > "$W/list"
python3 - "$W/list" <<'PY' || fail "free allowance counts a failed import"
import json,sys; d=json.load(open(sys.argv[1])); fa=d.get('freeAllowance') or d.get('freeImportAllowance') or {}
print('freeAllowance', {k:fa.get(k) for k in ('dailyFreeUsed','dailyFreeRemaining','monthlyPagesUsed','monthlyFreePageLimit','timezone')})
assert fa.get('dailyFreeUsed')==2, fa
PY
say "PASS free pool: 3 free pastes, 1 failed → dailyFreeUsed=2 (failed import not counted)"
kill -TERM $W1 $W2; for p in $W1 $W2; do rc=0; wait $p || rc=$?; [[ $rc == 0 ]] || fail "worker exit $rc on SIGTERM"; done; W1=""; W2=""
grep -q 'import worker stopped' "$W/w1.log" && grep -q 'import worker stopped' "$W/w2.log" || fail "no graceful stop log"
say "PASS SIGTERM: both workers exited 0 after graceful stop"
if grep -nE "Cannot find module|MODULE_NOT_FOUND" "$W"/*.log | tee -a "$R"; then fail "module-not-found"; fi
say "WORKER_STANDALONE_SMOKE OK"
