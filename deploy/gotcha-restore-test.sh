#!/bin/bash
# Monthly check: restore the latest dump into a scratch database, compare counts, drop it.
set -euo pipefail
DIR=/var/backups/gotcha
FILE="$DIR/latest.dump"
if [ ! -f "$FILE" ]; then
  echo "RESTORE_NO_DUMP" >&2
  exit 1
fi
docker exec gotcha-postgres psql -U gotcha -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS gotcha_restore_scratch;"
docker exec gotcha-postgres psql -U gotcha -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE gotcha_restore_scratch;"
docker cp "$FILE" gotcha-postgres:/tmp/gotcha-restore.dump
docker exec gotcha-postgres pg_restore -U gotcha -d gotcha_restore_scratch --no-owner --no-acl /tmp/gotcha-restore.dump
docker exec gotcha-postgres rm -f /tmp/gotcha-restore.dump
docker exec gotcha-postgres psql -U gotcha -d gotcha -t -A -c "SELECT json_build_object('users', (SELECT count(*) FROM users), 'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))::text;"
echo "----"
docker exec gotcha-postgres psql -U gotcha -d gotcha_restore_scratch -t -A -c "SELECT json_build_object('users', (SELECT count(*) FROM users), 'tables', (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'))::text;"
docker exec gotcha-postgres psql -U gotcha -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS gotcha_restore_scratch;"
echo "RESTORE_DROPPED"
