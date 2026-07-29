-- ============================================================
-- Appointment Lifecycle Engine: immutable audit trail (lib/ai/
-- appointments) for every transition of an appointment_drafts or
-- appointments row through its lifecycle -- draft creation, staff
-- approval/rejection/expiry, confirmation, check-in, in-progress,
-- completion, no-show, cancellation, rescheduling, reminders sent, and
-- archival.
--
-- Deliberately does NOT modify appointment_status or
-- appointment_draft_status, and does not add columns to appointments/
-- appointment_drafts -- the engine's finer-grained states that have no
-- matching DB column (checked_in, in_progress, archived) are derived
-- from the coarse status plus the latest event here (see lib/ai/
-- appointments/derive.ts), so this is a purely additive table. Written
-- to both by the AI orchestrator's admin client (draft creation,
-- AI-initiated cancel/reschedule) and by real staff sessions (the
-- existing approveDraft/rejectDraft/updateAppointmentStatus actions),
-- so RLS mirrors appointments'/appointment_drafts' own shape (any
-- active clinic member may select/insert) rather than the narrower
-- owner/admin-only ai_* observability tables -- this is core
-- appointment history relevant to all clinic staff, not internal AI
-- telemetry. No update/delete -- immutable, like ai_turn_events/
-- ai_decisions/audit_logs. No existing policy anywhere else is
-- modified.
-- ============================================================

create type appointment_lifecycle_entity as enum ('draft', 'appointment');

create type appointment_lifecycle_status as enum (
  'draft',
  'draft_approved',
  'draft_rejected',
  'draft_expired',
  'scheduled',
  'confirmed',
  'checked_in',
  'in_progress',
  'completed',
  'no_show',
  'cancelled',
  'archived'
);

create type appointment_lifecycle_event_type as enum (
  'create_draft',
  'approve',
  'reject',
  'expire',
  'confirm',
  'check_in',
  'start',
  'complete',
  'mark_no_show',
  'cancel',
  'reschedule',
  'send_reminder',
  'archive'
);

create type appointment_lifecycle_actor as enum ('ai_assistant', 'staff', 'system');

create table appointment_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  entity_type appointment_lifecycle_entity not null,
  appointment_id uuid references appointments (id) on delete cascade,
  appointment_draft_id uuid references appointment_drafts (id) on delete cascade,
  event appointment_lifecycle_event_type not null,
  from_status appointment_lifecycle_status,
  to_status appointment_lifecycle_status not null,
  actor appointment_lifecycle_actor not null default 'system',
  actor_id uuid references profiles (id) on delete set null,
  conversation_id uuid references ai_conversations (id) on delete set null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  check (
    (entity_type = 'draft' and appointment_draft_id is not null and appointment_id is null)
    or
    (entity_type = 'appointment' and appointment_id is not null and appointment_draft_id is null)
  )
);

create index appointment_lifecycle_events_clinic_id_idx on appointment_lifecycle_events (clinic_id, created_at desc);
create index appointment_lifecycle_events_appointment_id_idx on appointment_lifecycle_events (appointment_id, created_at desc);
create index appointment_lifecycle_events_draft_id_idx on appointment_lifecycle_events (appointment_draft_id, created_at desc);

alter table appointment_lifecycle_events enable row level security;

create policy appointment_lifecycle_events_select on appointment_lifecycle_events
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy appointment_lifecycle_events_insert on appointment_lifecycle_events
  for insert with check (clinic_id in (select auth_user_clinic_ids()));
