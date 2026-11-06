#!/bin/bash
# Every 5 minutes. Alerts Telegram chat 5710604544 once per failure, and once when it recovers.
set -u
STATE=/var/lib/gotcha-watch/state
mkdir -p /var/lib/gotcha-watch
ENV_FILE=/var/www/gotcha/.env
TOKEN=$(python3 - <<'PY'
from pathlib import Path
for line in Path("/var/www/gotcha/.env").read_text(errors="replace").splitlines():
    if line.startswith("TELEGRAM_BOT_TOKEN="):
        print(line.split("=",1)[1].strip().strip('"'))
        break
PY
)
CHAT=5710604544
problems=()

code_of() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$1" || echo 000
}
home=$(code_of https://gotchaa.uz/)
learn=$(code_of https://gotchaa.uz/learn/)
health=$(code_of https://gotchaa.uz/api/v1/health)
if [ "$home" != 200 ] || [ "$learn" != 200 ] || [ "$health" != 200 ]; then
  problems+=("site down home=$home learn=$learn health=$health")
fi

fivexx=$(python3 - <<'PY'
import re, time
from datetime import datetime
from pathlib import Path
p = Path("/var/log/nginx/access.log")
if not p.exists():
    print("0 0 0")
    raise SystemExit
cut = time.time() - 300
rx = re.compile(r"\[(\d{2}/[A-Za-z]{3}/\d{4}:\d{2}:\d{2}:\d{2}) ([+-]\d{4})\]")
five = hook = atmos = 0
for line in p.read_text(errors="replace").splitlines()[-5000:]:
    m = rx.search(line)
    if not m:
        continue
    try:
        ts = datetime.strptime(m.group(1) + m.group(2), "%d/%b/%Y:%H:%M:%S%z").timestamp()
    except Exception:
        continue
    if ts < cut:
        continue
    parts = line.split('"', 2)
    if len(parts) < 3:
        continue
    try:
        status = int(parts[2].strip().split()[0])
    except Exception:
        continue
    req = parts[1]
    if status >= 500:
        five += 1
    if "telegram/webhook" in req and status >= 400:
        hook += 1
    if "billing/atmos/webhook" in req and status >= 400:
        atmos += 1
print(f"{five} {hook} {atmos}")
PY
)
set -- $fivexx
five=${1:-0}; hook=${2:-0}; atmos=${3:-0}
if [ "$five" -ge 20 ]; then
  problems+=("5xx spike $five in the last 5 minutes")
fi
if [ "$hook" -ge 3 ]; then
  problems+=("bot webhook errors $hook")
fi
if [ "$atmos" -ge 1 ]; then
  problems+=("failed Atmos callback $atmos")
fi

if [ ! -f /var/backups/gotcha/latest.dump ]; then
  problems+=("backup missing")
else
  age=$(( $(date +%s) - $(stat -c %Y /var/backups/gotcha/latest.dump) ))
  if [ "$age" -gt 90000 ]; then
    problems+=("backup older than 25 hours")
  fi
fi

if [ -f /var/www/gotcha/services/api/mashq-progress.json ]; then
  stopped=$(python3 - <<'PY'
import json
from pathlib import Path
d=json.loads(Path("/var/www/gotcha/services/api/mashq-progress.json").read_text())
print(d.get("stopped") or "")
PY
)
  if [ -n "$stopped" ]; then
    problems+=("Mashq job stopped: $stopped")
  fi
fi

msg=$(printf '%s\n' "${problems[@]}")
prev=""
[ -f "$STATE" ] && prev=$(cat "$STATE")
if [ -n "$msg" ]; then
  if [ "$msg" != "$prev" ]; then
    curl -sS --max-time 15 -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
      -d "chat_id=${CHAT}" --data-urlencode "text=Gotcha alert: ${msg}" >/dev/null || true
    printf '%s' "$msg" > "$STATE"
  fi
else
  if [ -n "$prev" ]; then
    curl -sS --max-time 15 -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
      -d "chat_id=${CHAT}" --data-urlencode "text=Gotcha alert cleared." >/dev/null || true
  fi
  : > "$STATE"
fi
echo "WATCH home=$home learn=$learn health=$health five=$five hook=$hook atmos=$atmos problems=${#problems[@]}"
