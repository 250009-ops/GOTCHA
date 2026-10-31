-- WL4-14: schema says users.ui_language defaults to uz; the DB still had en from 0001. Default only, no data change.
ALTER TABLE "users" ALTER COLUMN "ui_language" SET DEFAULT 'uz';
