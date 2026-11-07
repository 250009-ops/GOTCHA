#!/bin/bash
# One Telegram note per day. Counts only. No secrets.
set -u
export TZ=Asia/Tashkent
ENV_FILE=/var/www/gotcha/.env
TOKEN=$(python3 - <<'PY'
from pathlib import Path
for line in Path("/var/www/gotcha/.env").read_text(errors="replace").splitlines():
    if line.startswith("TELEGRAM_BOT_TOKEN="):
        print(line.split("=", 1)[1].strip().strip('"'))
        break
PY
)
CHAT=5710604544
STATS=$(python3 - <<'PY'
import subprocess
sql = """
WITH taps AS (
  SELECT
    count(*) FILTER (WHERE mode IN ('dictionary','lemma_cache','memory')) AS free,
    count(*) FILTER (WHERE mode <> 'openai_error') AS taps
  FROM ai_lookup_costs
  WHERE created_at > now() - interval '24 hours'
),
spend AS (
  SELECT coalesce(sum(est_cost_usd), 0) AS usd
  FROM ai_lookup_costs
  WHERE created_at > now() - interval '24 hours' AND mode = 'openai'
),
ready AS (
  SELECT count(*) AS pages FROM (
    SELECT segment_id FROM page_questions WHERE status = 'active'
    GROUP BY segment_id HAVING count(*) >= 5
  ) s
),
catalog AS (
  SELECT count(*) AS pages
  FROM content_segments s
  JOIN content_items c ON c.id = s.content_id
  WHERE c.publish_status = 'published'
    AND c.content_source <> 'user_import'
    AND c.content_type <> 'user_import'
),
dict AS (
  SELECT count(*) FILTER (WHERE generator_version = 'cursor-v1') AS rows
  FROM word_dictionary
)
SELECT dict.rows, taps.free, taps.taps, ready.pages, catalog.pages, spend.usd
FROM taps, spend, ready, catalog, dict;
"""
try:
    out = subprocess.check_output(
        ["docker", "exec", "-i", "gotcha-postgres", "psql", "-U", "gotcha", "-d", "gotcha", "-At"],
        input=sql.encode(), stderr=subprocess.DEVNULL, timeout=30,
    ).decode().strip()
    print(out)
except Exception:
    print("0|0|0|0|0|0")
PY
)
IFS='|' read -r rows free taps ready catalog usd <<< "${STATS:-0|0|0|0|0|0}"
files=$(( ${rows:-0} / 300 ))
if [ "${taps:-0}" -gt 0 ]; then
  tap_pct=$(( 100 * ${free:-0} / taps ))
else
  tap_pct=0
fi
if [ "${catalog:-0}" -gt 0 ]; then
  page_pct=$(( 100 * ${ready:-0} / catalog ))
else
  page_pct=0
fi
TEXT="Gotcha daily: dictionary ${files}/598 files. Taps without AI ${tap_pct}% (${free}/${taps}). Pages with Mashq ${page_pct}% (${ready}/${catalog}). AI spend \$${usd}."
if [ -n "$TOKEN" ]; then
  curl -sS --max-time 20 -X POST "https://api.telegram.org/bot${TOKEN}/sendMessage" \
    -d "chat_id=${CHAT}" --data-urlencode "text=${TEXT}" >/dev/null || true
fi
echo "$TEXT"
