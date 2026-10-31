-- api-copy-fix-02 / QA AC1-01 + payments-02 (Kai 14:17, Sarvarbek 14:18 + 14:32): Plus prices and daily caps.
-- DATA-ONLY and idempotent. Run by DevOps at deploy time, AFTER migrations 0027-0029 (needs
-- subscription_plans.quiz_daily_quota; wlive owns 0022-0026, import-p0 0030) and AFTER a backup. NOT run by the Lead,
-- never against prod by hand.
--
-- Backup first. pg_dump rejects Prisma's "?schema=public" query string, so strip it:
--   pg_dump --format=custom --file="gotcha-before-plus-price-$(date +%Y%m%d%H%M).dump" "${DATABASE_URL%%\?*}"
--   psql "${DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f 2026-10-31-plus-price-uzs.sql
--
-- 24 990 soʻm  = 30-day pass  (subscription_plans.price_monthly of the Plus row; column name kept for clients)
-- 199 990 soʻm = 365-day pass (platform_settings, the keys the admin Plus price editor uses)
-- Caps/day: Free 20 lookups + 10 quizzes; Plus 200 quizzes and NO daily lookup cap
--   (plus.ai_lookup_quota = null, plus.lookup_hard_cap = null; a silent per-user speed guard applies).
-- The Plus row's ai_daily_quota is no longer read for Plus lookups and is left as is (wlive 0020 seeds 1000000).
BEGIN;

-- Plus row, targeted explicitly (wlive 0020_pricing seeds 34990 and the 'ai_lookup_unlimited' feature key).
UPDATE subscription_plans
   SET price_monthly = 24990,
       name = 'Plus',
       offline_enabled = false,
       quiz_daily_quota = 200,
       features = CASE
         WHEN features IS NULL OR jsonb_typeof(features) <> 'array' THEN features
         WHEN features ? 'ai_lookup' THEN features - 'ai_lookup_unlimited'
         ELSE (features - 'ai_lookup_unlimited') || '["ai_lookup"]'::jsonb
       END
 WHERE tier = 'premium';

-- Free row.
UPDATE subscription_plans
   SET ai_daily_quota = 20,
       quiz_daily_quota = 10
 WHERE tier = 'free';

INSERT INTO platform_settings (key, value, updated_at)
VALUES ('aiDefaultUserQuota', '20'::jsonb, now()),
       ('plus.pass.price_30_uzs', '24990'::jsonb, now()),
       ('plus.pass.price_365_uzs', '199990'::jsonb, now()),
       ('plus.ai_lookup_quota', 'null'::jsonb, now()),
       ('plus.lookup_hard_cap', 'null'::jsonb, now()),
       ('lookup.burst_per_minute', '30'::jsonb, now()),
       ('lookup.burst_per_hour', '300'::jsonb, now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Verify (expect free 20/10, premium 24990.00/quiz 200/no unlimited key; settings as above):
SELECT tier, name, price_monthly, ai_daily_quota, quiz_daily_quota, offline_enabled, features ? 'ai_lookup_unlimited' AS has_unlimited FROM subscription_plans ORDER BY tier;
SELECT key, value FROM platform_settings WHERE key IN ('aiDefaultUserQuota', 'plus.pass.price_30_uzs', 'plus.pass.price_365_uzs', 'plus.ai_lookup_quota', 'plus.lookup_hard_cap', 'lookup.burst_per_minute', 'lookup.burst_per_hour') ORDER BY key;

COMMIT;
