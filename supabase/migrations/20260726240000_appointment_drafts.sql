-- ============================================================
-- Appointment drafts: what the AI orchestration layer's
-- draft_appointment tool writes to instead of ever touching
-- appointments directly.
--
-- Top-level clinic resource (direct clinic_id), same shape as
-- appointments. patient_id is optional -- the realistic case for a
-- patient-facing AI is an inbound message from a phone number that
-- doesn't correspond to a patients row yet, so patient_name/
-- patient_phone capture enough to follow up, to be reconciled by
-- staff later (that reconciliation UI is a future phase, not built
-- here).
--
-- Deliberately has no DB-level exclusion constraint like
-- appointments does -- a draft is a non-binding proposal, not a
-- real booking, so the AI tool layer checks for conflicts against
-- real appointments in application code before inserting (see
-- lib/ai/tools/draft-appointment.ts).
--
-- RLS mirrors appointments exactly: any active member may select/
-- insert/update, no delete. No existing policy anywhere else is
-- modified.
-- ============================================================

create type appointment_draft_status as enum ('proposed', 'confirmed', 'rejected', 'expired');

create table appointment_drafts (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  conversation_id uuid references ai_conversations (id) on delete set null,
  patient_id uuid references patients (id) on delete set null,
  patient_name text,
  patient_phone text,
  dentist_id uuid not null references dentists (id) on delete restrict,
  service_id uuid references services (id) on delete set null,
  proposed_start_at timestamptz not null,
  proposed_end_at timestamptz not null,
  status appointment_draft_status not null default 'proposed',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (proposed_end_at > proposed_start_at)
);

create index appointment_drafts_clinic_id_idx on appointment_drafts (clinic_id, proposed_start_at);
create index appointment_drafts_dentist_id_idx on appointment_drafts (dentist_id);

create trigger appointment_drafts_set_updated_at
  before update on appointment_drafts
  for each row execute function set_updated_at();

-- Cross-reference consistency: dentist_id/service_id/patient_id (when
-- set) must all belong to the same clinic_id -- same pattern as
-- validate_appointment_clinic_consistency.
create function validate_appointment_draft_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from dentists
    where dentists.id = new.dentist_id
      and dentists.clinic_id = new.clinic_id
  ) then
    raise exception 'appointment_drafts.dentist_id must belong to the same clinic_id';
  end if;

  if new.service_id is not null and not exists (
    select 1 from services
    where services.id = new.service_id
      and services.clinic_id = new.clinic_id
  ) then
    raise exception 'appointment_drafts.service_id must belong to the same clinic_id';
  end if;

  if new.patient_id is not null and not exists (
    select 1 from patients
    where patients.id = new.patient_id
      and patients.clinic_id = new.clinic_id
  ) then
    raise exception 'appointment_drafts.patient_id must belong to the same clinic_id';
  end if;

  return new;
end;
$$;

create trigger appointment_drafts_check_consistency
  before insert or update of clinic_id, dentist_id, service_id, patient_id on appointment_drafts
  for each row execute function validate_appointment_draft_consistency();

alter table appointment_drafts enable row level security;

create policy appointment_drafts_select on appointment_drafts
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy appointment_drafts_insert on appointment_drafts
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

create policy appointment_drafts_update on appointment_drafts
  for update using (clinic_id in (select auth_user_clinic_ids()));
