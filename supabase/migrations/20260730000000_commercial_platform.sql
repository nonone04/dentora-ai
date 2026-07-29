-- Commercial platform foundation: interactive demo environment + first-run
-- onboarding tour. Both columns are additive and nullable/defaulted, so no
-- existing row or query is affected.

-- Marks a clinic as the shared interactive demo sandbox. Used to gate the
-- demo banner/reset action and to make sure "reset demo data" can never be
-- pointed at a real clinic even if the clinicId were guessed or tampered
-- with client-side.
alter table clinics add column is_demo boolean not null default false;

-- Set once a user has completed or skipped the first-run product tour, so
-- it never reappears. Tracked per-profile (not per-clinic-membership) --
-- the tour teaches the product shell itself, which is the same regardless
-- of which clinic the user is currently in.
alter table profiles add column onboarding_tour_completed_at timestamptz;
