-- WLF-12 (steering 3; scope cut 2026-10-31 16:19): Free daily caps live in platform_settings ONLY. DATA-ONLY, idempotent, reviewable.
-- NOT RUN ON PROD. Prod data changes need Sarvarbek's explicit go. Run by DevOps AFTER migrations 0027-0033 and a backup:
--   pg_dump --format=custom --file="gotcha-before-wlf12-$(date +%Y%m%d%H%M).dump" "${DATABASE_URL%%\?*}"
--   psql "${DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f 2026-10-31-wlf12-free-caps.sql
-- Code no longer reads subscription_plans.ai_daily_quota / import_limit / quiz_daily_quota for enforcement or display;
-- the plan-row UPDATE below is only so the legacy columns stop disagreeing (prod today: Free 100 imports / 5000 lookups).
BEGIN;
INSERT INTO platform_settings (key, value, updated_at)
VALUES ('caps.free.lookups', '20'::jsonb, now()),
       ('caps.free.quizzes', '10'::jsonb, now()),
       ('caps.plus.quizzes', '200'::jsonb, now()),
       ('aiDefaultUserQuota', '20'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
-- importFreeLimits (3 imports a day + 50 pages a month, Sarvarbek via Kai 2026-10-31) is NOT in this file:
-- DevOps updates that live setting through admin Import & Pricing. Do not add it here.
UPDATE subscription_plans SET import_limit = 3, ai_daily_quota = 20 WHERE tier = 'free';
-- Verify: expect caps 20/10/200, Free row 3/20.
SELECT key, value FROM platform_settings WHERE key IN ('caps.free.lookups','caps.free.quizzes','caps.plus.quizzes','aiDefaultUserQuota') ORDER BY key;
SELECT tier, import_limit, ai_daily_quota FROM subscription_plans ORDER BY tier;
COMMIT;
