#!/usr/bin/env bash
# covers-01: 0038_cover_template on a THROWAWAY PostgreSQL 16 — up, idempotent re-run, per-book revert, full rollback, re-apply.
# usage: PG16_BIN=/path/to/pg16/bin scripts/test-cover-migration-pg16.sh   (local only; never a real DB)
set -euo pipefail
cd "$(dirname "$0")/.."
BIN="${PG16_BIN:?set PG16_BIN to a PostgreSQL 16 bin dir}"
"$BIN/postgres" --version | grep -q ' 16\.' || { echo "PG16_BIN is not PostgreSQL 16"; exit 2; }
PORT="${PG16_PORT:-55491}"; W="$(mktemp -d /tmp/covers01-pg16.XXXX)"; U="$W/uploads"
PSQL="$(command -v psql)"
cleanup() { "$BIN/pg_ctl" -D "$W/pg" -m fast stop >/dev/null 2>&1 || true; rm -rf "$W"; }
trap cleanup EXIT
"$BIN/initdb" -D "$W/pg" -U t --auth=trust >/dev/null
"$BIN/pg_ctl" -D "$W/pg" -o "-p $PORT -k $W -c listen_addresses=127.0.0.1" -l "$W/pg.log" -w start >/dev/null
q() { "$PSQL" -h 127.0.0.1 -p "$PORT" -U t -d c01 -v ON_ERROR_STOP=1 -qAt "$@"; }
"$PSQL" -h 127.0.0.1 -p "$PORT" -U t -d postgres -qc "create database c01"
echo "server: $(q -c 'show server_version')"
export DATABASE_URL="postgresql://t@127.0.0.1:$PORT/c01"
# 1. all migrations BEFORE 0038
mkdir -p "$W/prisma"; cp prisma/schema.prisma "$W/prisma/"; cp -r prisma/migrations "$W/prisma/"; rm -rf "$W/prisma/migrations/0038_cover_template"
npx --no-install prisma migrate deploy --schema "$W/prisma/schema.prisma" >"$W/m1.log" 2>&1 || { cat "$W/m1.log"; exit 1; }
LAST=$(q -c "select migration_name from _prisma_migrations order by migration_name desc limit 1"); echo "pre: last = $LAST"
# 2. fixture rows like prod: catalog books with/without covers, a user import (continue-reading hero), cover files on disk
mkdir -p "$U/covers"; head -c 2048 /dev/urandom > "$U/covers/aaaaaaaa-0000-0000-0000-000000000001.jpg"; head -c 2048 /dev/urandom > "$U/covers/aaaaaaaa-0000-0000-0000-000000000003.png"
FILES_MD5=$(cd "$U" && find . -type f | sort | xargs md5sum | md5sum)
q <<'SQL'
insert into users (id, email, native_language, updated_at) values ('bbbbbbbb-0000-0000-0000-000000000001','m@test.local','en', now());
insert into content_items (id, slug, title, language, content_type, content_source, cefr_level, genre, cover_image_key, publish_status, updated_at, created_by) values
 ('aaaaaaaa-0000-0000-0000-000000000001','crime','Crime and Punishment','en','book','public_domain','c1','classic','/uploads/covers/aaaaaaaa-0000-0000-0000-000000000001.jpg?v=1','published',now(),null),
 ('aaaaaaaa-0000-0000-0000-000000000002','oтkan','Oʻtkan kunlar','uz','book','public_domain','b2','novel',null,'published',now(),null),
 ('aaaaaaaa-0000-0000-0000-000000000003','prest','Преступление и наказание','ru','book','public_domain','c1',null,'/uploads/covers/aaaaaaaa-0000-0000-0000-000000000003.png?v=2','published',now(),null),
 ('aaaaaaaa-0000-0000-0000-000000000004','imp','My PDF','en','user_import','user_import','b1',null,'https://cdn.example/x.jpg','draft',now(),'bbbbbbbb-0000-0000-0000-000000000001');
insert into reading_progress (user_id, content_id, progress_pct) values ('bbbbbbbb-0000-0000-0000-000000000001','aaaaaaaa-0000-0000-0000-000000000001',5);
SQL
SNAP() { q -c "select md5(string_agg(id::text||'|'||coalesce(cover_image_key,'∅')||'|'||title, ',' order by id)) from content_items"; }
BEFORE=$(SNAP); N0=$(q -c "select count(*) from content_items")
# 3. UP
q -f prisma/migrations/0038_cover_template/migration.sql
[ "$(SNAP)" = "$BEFORE" ] || { echo "FAIL: cover_image_key/title changed"; exit 1; }
[ "$(q -c 'select count(*) from content_items')" = "$N0" ] || { echo "FAIL: row count"; exit 1; }
[ "$(q -c "select count(*) from content_items where cover_mode<>'template'")" = 0 ] || { echo "FAIL: not all template"; exit 1; }
[ "$(q -c "select count(*) from content_items where original_cover_key is distinct from cover_image_key")" = 0 ] || { echo "FAIL: original snapshot"; exit 1; }
[ "$(q -c "select count(*) from content_items c join reading_progress r on r.content_id=c.id where c.cover_mode='template'")" = 1 ] || { echo "FAIL: hero book"; exit 1; }
q -c "select column_default, is_nullable from information_schema.columns where table_name='content_items' and column_name='cover_mode'" | grep -q "'template'::text|NO" || { echo "FAIL: default"; exit 1; }
echo "up: OK ($N0 rows -> template, originals kept)"
# new rows default to template; CHECK rejects junk
q -c "insert into content_items (id, slug, title, language, content_type, content_source, cefr_level, updated_at) values ('aaaaaaaa-0000-0000-0000-000000000005','new','New','en','book','public_domain','a1',now())"
[ "$(q -c "select cover_mode from content_items where slug='new'")" = template ] || { echo "FAIL: default for new rows"; exit 1; }
if q -c "update content_items set cover_mode='bogus' where slug='new'" 2>/dev/null; then echo "FAIL: CHECK"; exit 1; fi
# 4. admin choices survive a RE-RUN (idempotent), originals never re-snapshotted over
q -c "update content_items set cover_mode='upload', cover_image_key='/uploads/covers/x-u1.jpg' where slug='crime'"
q -c "update content_items set cover_mode='original' where slug='prest'"
S2=$(q -c "select md5(string_agg(id::text||cover_mode||coalesce(cover_image_key,'')||coalesce(original_cover_key,''),',' order by id)) from content_items")
q -f prisma/migrations/0038_cover_template/migration.sql
q -f prisma/migrations/0038_cover_template/migration.sql
[ "$S2" = "$(q -c "select md5(string_agg(id::text||cover_mode||coalesce(cover_image_key,'')||coalesce(original_cover_key,''),',' order by id)) from content_items")" ] || { echo "FAIL: re-run changed data"; exit 1; }
echo "idempotent re-run x2: OK"
# 5. per-book revert
q -c "update content_items set cover_mode='original' where slug='crime'"
[ "$(q -c "select original_cover_key from content_items where slug='crime'")" = "/uploads/covers/aaaaaaaa-0000-0000-0000-000000000001.jpg?v=1" ] || { echo "FAIL: per-book revert"; exit 1; }
echo "per-book revert: OK"
# 6. full rollback (with the optional restore of originals), then data == pre-migration
q -c "update content_items set cover_image_key = original_cover_key where original_cover_key is not null and cover_image_key is distinct from original_cover_key"
q -c "delete from content_items where slug='new'"
q -f prisma/rollback/0038_cover_template.rollback.sql
[ "$(SNAP)" = "$BEFORE" ] || { echo "FAIL: rollback not lossless"; exit 1; }
[ "$(q -c "select count(*) from information_schema.columns where table_name='content_items' and column_name in ('cover_mode','original_cover_key')")" = 0 ] || { echo "FAIL: columns remain"; exit 1; }
echo "rollback: OK (data identical to pre-migration)"
# 7. re-apply via prisma migrate deploy (the DevOps path) + schema drift check
npx --no-install prisma migrate deploy >"$W/m2.log" 2>&1 || { cat "$W/m2.log"; exit 1; }
grep -q 0038_cover_template "$W/m2.log" || { cat "$W/m2.log"; echo "FAIL: deploy did not apply 0038"; exit 1; }
[ "$(q -c "select count(*) from content_items where cover_mode='template'")" = "$N0" ] || { echo "FAIL: re-apply"; exit 1; }
"$PSQL" -h 127.0.0.1 -p "$PORT" -U t -d postgres -qc "create database c01_shadow"
DIFF=$(npx --no-install prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "postgresql://t@127.0.0.1:$PORT/c01_shadow" --script 2>&1 || true)
echo "$DIFF" | grep -qiE '^(ALTER|CREATE|DROP)' && { echo "FAIL: schema drift:"; echo "$DIFF"; exit 1; }
echo "prisma migrate deploy + no drift: OK"
[ "$FILES_MD5" = "$(cd "$U" && find . -type f | sort | xargs md5sum | md5sum)" ] || { echo "FAIL: files changed"; exit 1; }
echo "cover files untouched: OK"
echo "covers-01 migration PG16 tests: OK"
