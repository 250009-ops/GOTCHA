#!/bin/bash
# Daily Postgres dump. Keeps 14 days on the server. Prints the file path and size only.
set -euo pipefail
export TZ=Asia/Tashkent
DIR=/var/backups/gotcha
mkdir -p "$DIR"
STAMP=$(date +%Y%m%d-%H%M)
FILE="$DIR/gotcha-$STAMP.dump"
docker exec gotcha-postgres pg_dump -U gotcha -d gotcha -Fc > "$FILE"
BYTES=$(stat -c%s "$FILE")
if [ "$BYTES" -lt 1000000 ]; then
  echo "BACKUP_TOO_SMALL $BYTES" >&2
  exit 1
fi
find "$DIR" -name 'gotcha-*.dump' -mtime +14 -delete
ln -sfn "$FILE" "$DIR/latest.dump"
echo "BACKUP_OK $FILE $BYTES"

# Off-site copy. Same four variables work for Cloudflare R2 and Backblaze B2 (S3-compatible).
# BACKUP_S3_ENDPOINT  BACKUP_S3_BUCKET  BACKUP_S3_ACCESS_KEY  BACKUP_S3_SECRET_KEY
# Optional: BACKUP_S3_REGION (default auto), BACKUP_S3_PREFIX (default gotcha)
ENV_FILE=/var/www/gotcha/.env
get_env() {
  python3 - "$1" <<'PY'
import sys
from pathlib import Path
key = sys.argv[1]
for line in Path("/var/www/gotcha/.env").read_text(errors="replace").splitlines():
    if line.startswith(key + "="):
        print(line.split("=", 1)[1].strip().strip('"').strip("'"))
        break
PY
}
S3_ENDPOINT="$(get_env BACKUP_S3_ENDPOINT)"
S3_BUCKET="$(get_env BACKUP_S3_BUCKET)"
S3_KEY="$(get_env BACKUP_S3_ACCESS_KEY)"
S3_SECRET="$(get_env BACKUP_S3_SECRET_KEY)"
S3_REGION="$(get_env BACKUP_S3_REGION)"
S3_PREFIX="$(get_env BACKUP_S3_PREFIX)"
S3_REGION="${S3_REGION:-auto}"
S3_PREFIX="${S3_PREFIX:-gotcha}"
if [ -z "$S3_BUCKET" ] || [ -z "$S3_ENDPOINT" ] || [ -z "$S3_KEY" ] || [ -z "$S3_SECRET" ]; then
  echo "BACKUP_OFFSITE_UNCONFIGURED"
elif ! command -v aws >/dev/null 2>&1; then
  echo "BACKUP_OFFSITE_NO_CLI"
else
  AWS_ACCESS_KEY_ID="$S3_KEY" AWS_SECRET_ACCESS_KEY="$S3_SECRET" AWS_DEFAULT_REGION="$S3_REGION" \
    aws s3 cp --only-show-errors --endpoint-url "$S3_ENDPOINT" "$FILE" "s3://${S3_BUCKET}/${S3_PREFIX}/$(basename "$FILE")"
  date +%s > "$DIR/offsite-ok"
  echo "BACKUP_OFFSITE_OK"
fi
