-- Remember that the learner finished the first-run tour, so it does not return on a new device.
ALTER TABLE "user_preferences" ADD COLUMN "onboarding_done" BOOLEAN NOT NULL DEFAULT false;
