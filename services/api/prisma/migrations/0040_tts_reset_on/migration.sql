-- SET-2 release note
-- Pronunciation (tts_enabled) defaulted to on in the database, but the old Settings
-- toggle showed off and, once saving started to work, wrote false for anyone who
-- pressed Save. user_preferences has no updated_at, so those rows cannot be told
-- apart from a later intentional off.
-- Owner decision (31 Oct 2026): turn pronunciation back on for every stored false.
-- Learners who want it off can switch it off again in Settings; that choice sticks.
UPDATE "user_preferences" SET "tts_enabled" = true WHERE "tts_enabled" = false;
