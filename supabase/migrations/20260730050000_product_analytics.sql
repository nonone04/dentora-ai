-- ============================================================
-- Product analytics event log (Dentora Beta Sprint 2).
--
-- Cross-cutting, cross-clinic product-usage telemetry -- distinct from
-- audit_logs (clinic-scoped compliance trail) and account_security_events
-- (auth-security trail). Written exclusively through lib/telemetry via
-- the service-role client (lib/supabase/admin.ts), never through a normal
-- RLS-scoped client, so there is no insert policy for regular sessions.
--
-- clinic_id/user_id are nullable and ON DELETE SET NULL: deleting a clinic
-- or user must never fail or cascade-delete historical usage counts (DAU/
-- MAU math would silently shift), it should just anonymize the row.
--
-- properties is intentionally a free-form jsonb bag, but lib/telemetry's
-- typed event union + lib/telemetry/privacy.ts's sanitizeProperties() are
-- the only path allowed to populate it -- never patient notes, medical
-- records, conversation contents, passwords, tokens, or API keys. See
-- docs/product-analytics.md for the enforced privacy policy.
--
-- No select policy is defined: this data is read only by the internal
-- admin dashboard (lib/telemetry/query.ts), which also uses the
-- service-role client after lib/telemetry/admin-access.ts's platform-admin
-- allowlist check -- never through a clinic member's RLS-scoped session.
-- ============================================================

create table analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null,
  clinic_id uuid references clinics (id) on delete set null,
  user_id uuid references profiles (id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index analytics_events_name_occurred_idx on analytics_events (event_name, occurred_at desc);
create index analytics_events_clinic_occurred_idx on analytics_events (clinic_id, occurred_at desc);
create index analytics_events_user_occurred_idx on analytics_events (user_id, occurred_at desc);

alter table analytics_events enable row level security;

-- No policies: writes and reads are service-role only (see header note).

-- ============================================================
-- Latest known non-PHI traits per user (language, country, clinic size,
-- plan, trial status, role, timezone -- see docs/product-analytics.md).
-- One row per user, upserted by lib/telemetry's identify().
-- ============================================================

create table analytics_user_traits (
  user_id uuid primary key references profiles (id) on delete cascade,
  traits jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table analytics_user_traits enable row level security;

-- No policies: writes and reads are service-role only (see header note).
