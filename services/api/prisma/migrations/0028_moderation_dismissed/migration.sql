-- web-launch-04 final-5 (Kai): moderation outcome "dismissed" = close the queue row, keep the import private,
-- publish state unchanged. Additive enum value only; no rows touched.
ALTER TYPE "ModerationStatus" ADD VALUE IF NOT EXISTS 'dismissed';
