-- ============================================================
-- Patient Intelligence Engine (lib/ai/patient): an immutable activity
-- timeline plus a materialized, versioned patient profile (reliability
-- score, learned communication/scheduling preferences, a summary)
-- derived from it. Consumes events from the Appointment Lifecycle
-- Engine (lib/ai/appointments) and conversation updates from the
-- orchestrator -- purely additive, does not modify patients or any
-- other existing table/enum.
-- ============================================================

create type patient_activity_type as enum (
  'appointment_draft_created',
  'appointment_approved',
  'appointment_rejected',
  'appointment_confirmed',
  'appointment_rescheduled',
  'appointment_checked_in',
  'appointment_started',
  'appointment_completed',
  'appointment_no_show',
  'appointment_cancelled',
  'appointment_archived',
  'conversation_started',
  'conversation_escalated'
);

-- ============================================================
-- patient_activity_events: immutable timeline, one row per notable
-- thing that happened involving a patient. Same rationale/shape as
-- appointment_lifecycle_events -- a top-level clinic resource, RLS
-- mirroring patients' own (any active clinic member may select/insert),
-- no update/delete.
-- ============================================================
create table patient_activity_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  type patient_activity_type not null,
  appointment_id uuid references appointments (id) on delete set null,
  conversation_id uuid references ai_conversations (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index patient_activity_events_patient_id_idx on patient_activity_events (patient_id, created_at desc);
create index patient_activity_events_clinic_id_idx on patient_activity_events (clinic_id, created_at desc);

alter table patient_activity_events enable row level security;

create policy patient_activity_events_select on patient_activity_events
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy patient_activity_events_insert on patient_activity_events
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

-- ============================================================
-- patient_profiles: one materialized row per patient, recomputed by
-- lib/ai/patient/store.ts's refreshPatientProfile from
-- patient_activity_events + appointments + ai_conversations. Optimistic
-- concurrency via `version`, same compare-and-swap pattern as
-- conversation_states. RLS mirrors patients' own shape (any active
-- clinic member may select/insert/update, no delete) -- this is a
-- working record staff (and the AI) read, not append-only telemetry.
-- ============================================================
create type patient_reliability_label as enum ('excellent', 'good', 'fair', 'poor', 'insufficient_data');
create type patient_summary_source as enum ('rule_based', 'llm');
create type patient_time_of_day as enum ('morning', 'afternoon', 'evening');

create table patient_profiles (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  reliability_score numeric(3, 2) not null default 0 check (reliability_score >= 0 and reliability_score <= 1),
  reliability_label patient_reliability_label not null default 'insufficient_data',
  completed_count int not null default 0,
  no_show_count int not null default 0,
  cancelled_count int not null default 0,
  preferred_channel notification_channel,
  -- How many past conversations the channel preference above was learned
  -- from -- not derivable from the appointment counts above (a
  -- separate signal), so it needs its own column.
  channel_sample_size int not null default 0,
  preferred_time_of_day patient_time_of_day,
  preferred_dentist_id uuid references dentists (id) on delete set null,
  summary text not null default '',
  summary_source patient_summary_source not null default 'rule_based',
  -- Optimistic concurrency: lib/ai/patient/store.ts's refreshPatientProfile
  -- does a compare-and-swap on this column, same pattern as
  -- conversation_states/appointment_lifecycle_events' underlying tables.
  version int not null default 1,
  last_computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, patient_id)
);

create index patient_profiles_clinic_id_idx on patient_profiles (clinic_id, updated_at desc);

create trigger patient_profiles_set_updated_at
  before update on patient_profiles
  for each row execute function set_updated_at();

alter table patient_profiles enable row level security;

create policy patient_profiles_select on patient_profiles
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy patient_profiles_insert on patient_profiles
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

create policy patient_profiles_update on patient_profiles
  for update using (clinic_id in (select auth_user_clinic_ids()));
