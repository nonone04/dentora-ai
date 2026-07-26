-- ============================================================
-- Audit logging foundation.
--
-- audit_logs is a top-level clinic resource (like appointments,
-- patients, dentists) rather than a child-of-one-parent record, so
-- it stores clinic_id directly -- entries reference varying entity
-- types (appointment, notification, clinic_member, ...) rather than
-- always going through one fixed parent table.
--
-- RLS: select is owner/admin only (operational history, not general
-- clinic data). Insert is open to any active member -- matching the
-- existing pattern used everywhere else in this schema -- but the
-- with check additionally requires actor_id to be the caller's own
-- auth.uid() (or null, for system-generated entries written via the
-- admin client in the notification processor). That's a small,
-- cheap integrity guarantee beyond plain consistency: a forged
-- attribution ("owner did this" when they didn't) is a meaningfully
-- different risk than a forged row in most other tables. No update
-- or delete policy at all -- audit entries are immutable. No
-- existing policy anywhere else is modified.
-- ============================================================

create type audit_action as enum (
  'appointment_status_changed',
  'notification_sent',
  'notification_failed',
  'member_invited',
  'member_invitation_accepted'
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  actor_id uuid references profiles (id) on delete set null,
  action audit_action not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_clinic_id_idx on audit_logs (clinic_id, created_at desc);

alter table audit_logs enable row level security;

create policy audit_logs_select on audit_logs
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy audit_logs_insert on audit_logs
  for insert with check (
    clinic_id in (select auth_user_clinic_ids())
    and (actor_id = auth.uid() or actor_id is null)
  );
