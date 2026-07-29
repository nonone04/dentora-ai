-- ============================================================
-- Notification & Communication Platform (lib/notifications): a
-- provider-agnostic, typed, retryable delivery pipeline layered
-- alongside the existing notifications table/schedule.ts/process.ts.
--
-- Deliberately does NOT modify the existing `notifications` table,
-- its enums (notification_type/notification_channel/notification_status),
-- or patients.reminder_opt_in/preferred_contact_channel -- that system
-- keeps serving staff-driven flows exactly as before (approveDraft,
-- updateAppointmentStatus in app/actions/*). This is a second, additive
-- pipeline for AI-initiated events (Appointment Lifecycle Engine
-- transitions reached via the AI tools, AI-created drafts, AI
-- escalations), which the old system never had a hook for.
--
-- Two tables, same split as appointment_lifecycle_events /
-- patient_profiles:
--   - notification_events: immutable log of "something happened that
--     may need to notify someone" (mirrors appointment_lifecycle_events/
--     patient_activity_events -- any active clinic member may
--     select/insert, no update/delete).
--   - notification_deliveries: one row per actual message attempt,
--     a working record with a real status machine (pending -> sending
--     -> sent -> delivered -> read, or -> failed) and optimistic
--     concurrency via `version` (mirrors patient_profiles/
--     conversation_states -- any active clinic member may
--     select/insert/update, no delete).
-- ============================================================

create type notification_event_type as enum (
  'appointment_booked',
  'appointment_confirmed',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_reminder',
  'conversation_escalated'
);

create type notification_recipient_type as enum ('patient', 'staff');

-- Deliberately a NEW, separate enum from the existing notification_channel
-- (email/sms/whatsapp) rather than widening it -- this pipeline adds
-- an in_app channel the old one never had, and existing enums are never
-- altered.
create type notification_delivery_channel as enum ('email', 'sms', 'whatsapp', 'in_app');

create type notification_delivery_status as enum ('pending', 'sending', 'sent', 'delivered', 'read', 'failed');

-- ============================================================
-- notification_events
-- ============================================================
create table notification_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  type notification_event_type not null,
  appointment_id uuid references appointments (id) on delete cascade,
  appointment_draft_id uuid references appointment_drafts (id) on delete cascade,
  patient_id uuid references patients (id) on delete set null,
  conversation_id uuid references ai_conversations (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index notification_events_clinic_id_idx on notification_events (clinic_id, created_at desc);
create index notification_events_appointment_id_idx on notification_events (appointment_id, created_at desc);
create index notification_events_appointment_draft_id_idx on notification_events (appointment_draft_id, created_at desc);

alter table notification_events enable row level security;

create policy notification_events_select on notification_events
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy notification_events_insert on notification_events
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

-- ============================================================
-- notification_deliveries
-- ============================================================
create table notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  notification_event_id uuid not null references notification_events (id) on delete cascade,
  recipient_type notification_recipient_type not null,
  recipient_patient_id uuid references patients (id) on delete set null,
  -- Resolved to/email/phone/staff-email at creation time -- denormalized
  -- so a retry doesn't silently pick up a since-changed contact address,
  -- and so a delivery remains fully self-describing even if the patient
  -- row is later deleted (recipient_patient_id -> set null above).
  recipient_address text,
  channel notification_delivery_channel not null,
  template_key text not null,
  language text not null default 'en' check (language in ('ar', 'fr', 'en')),
  status notification_delivery_status not null default 'pending',
  scheduled_for timestamptz not null default now(),
  attempts int not null default 0,
  max_attempts int not null default 5,
  next_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  -- Optimistic concurrency: lib/notifications/store.ts does a
  -- compare-and-swap on this column, same pattern as
  -- conversation_states/patient_profiles/appointment_lifecycle_events'
  -- underlying tables.
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_deliveries_due_idx on notification_deliveries (clinic_id, status, scheduled_for);
create index notification_deliveries_event_id_idx on notification_deliveries (notification_event_id);

create trigger notification_deliveries_set_updated_at
  before update on notification_deliveries
  for each row execute function set_updated_at();

alter table notification_deliveries enable row level security;

create policy notification_deliveries_select on notification_deliveries
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy notification_deliveries_insert on notification_deliveries
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

create policy notification_deliveries_update on notification_deliveries
  for update using (clinic_id in (select auth_user_clinic_ids()));
