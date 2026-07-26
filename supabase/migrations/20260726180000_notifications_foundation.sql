-- ============================================================
-- Notifications foundation: schema + preferences only.
--
-- No delivery integration here (see lib/notifications/ for the
-- provider abstraction, which defaults to a logging no-op). This
-- migration exists so real appointment/patient/clinic state has
-- somewhere to record notification *intent*.
--
-- notifications is a child record of appointments, so -- following
-- the same convention already used by medical_notes/treatments for
-- records of patients -- it derives clinic scope via appointment_id
-- rather than storing clinic_id directly. RLS mirrors appointments
-- exactly (any active member select/insert/update, no delete). No
-- existing policy is modified.
-- ============================================================

create type notification_type as enum ('reminder', 'confirmation', 'cancellation');
create type notification_channel as enum ('email', 'sms', 'whatsapp');
create type notification_status as enum ('pending', 'sent', 'failed', 'skipped');

-- ------------------------------------------------------------
-- Patient-level preferences, same style as the existing
-- preferred_language column.
-- ------------------------------------------------------------
alter table patients
  add column reminder_opt_in boolean not null default true,
  add column preferred_contact_channel notification_channel not null default 'email';

-- ------------------------------------------------------------
-- notifications
-- ------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  type notification_type not null,
  channel notification_channel not null,
  status notification_status not null default 'pending',
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notifications_appointment_id_idx on notifications (appointment_id);
create index notifications_patient_id_idx on notifications (patient_id);

create trigger notifications_set_updated_at
  before update on notifications
  for each row execute function set_updated_at();

-- Cross-reference consistency: patient_id must match the referenced
-- appointment's patient. security definer, same reasoning as
-- validate_treatment_consistency.
create function validate_notification_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from appointments
    where appointments.id = new.appointment_id
      and appointments.patient_id = new.patient_id
  ) then
    raise exception 'notifications.patient_id must match the appointment''s patient';
  end if;
  return new;
end;
$$;

create trigger notifications_check_consistency
  before insert or update of appointment_id, patient_id on notifications
  for each row execute function validate_notification_consistency();

alter table notifications enable row level security;

create policy notifications_select on notifications
  for select using (
    appointment_id in (select id from appointments where clinic_id in (select auth_user_clinic_ids()))
  );

create policy notifications_insert on notifications
  for insert with check (
    appointment_id in (select id from appointments where clinic_id in (select auth_user_clinic_ids()))
  );

create policy notifications_update on notifications
  for update using (
    appointment_id in (select id from appointments where clinic_id in (select auth_user_clinic_ids()))
  );
