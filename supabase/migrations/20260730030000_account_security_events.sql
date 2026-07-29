-- ============================================================
-- Account-level security event log.
--
-- audit_logs (see 20260726200000_audit_logs.sql) is clinic-scoped:
-- clinic_id is not null, and every existing policy/query assumes a
-- clinic context. Account-security events (failed logins, lockouts,
-- password resets, session revocations, email verification) happen
-- before authentication exists at all, or for a user who belongs to
-- zero or several clinics -- there is no single clinic_id to attach
-- them to. Rather than relaxing audit_logs's NOT NULL constraint
-- (which every existing clinic-scoped RLS policy and query assumes),
-- this is a separate, purpose-built, user-scoped table.
--
-- user_id is nullable: a failed login against an email that has no
-- account can't resolve to a user_id, and must not resolve to one by
-- probing -- that would itself be an information leak. Combined with
-- the select policy below, a null-user_id row is simply never
-- visible to anyone, which is the correct behavior (nobody "owns"
-- that failed attempt).
--
-- All writes go through the service-role client (lib/supabase/admin.ts)
-- rather than a normal insert policy, since some events (failed
-- login, lockout) have no authenticated session to satisfy a
-- `with check (user_id = auth.uid())` insert policy against.
-- ============================================================

create type account_security_event_type as enum (
  'login_succeeded',
  'login_failed',
  'account_locked',
  'password_reset_requested',
  'password_reset_completed',
  'password_changed',
  'email_verification_sent',
  'email_verified',
  'session_revoked',
  'all_other_sessions_revoked'
);

create table account_security_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles (id) on delete cascade,
  event_type account_security_event_type not null,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index account_security_events_user_id_idx on account_security_events (user_id, created_at desc);

alter table account_security_events enable row level security;

create policy account_security_events_select on account_security_events
  for select using (user_id = auth.uid());

-- No insert/update/delete policy: writes are service-role only.
