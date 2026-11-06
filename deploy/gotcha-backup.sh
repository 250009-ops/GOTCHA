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
