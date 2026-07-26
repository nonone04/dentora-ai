-- ============================================================
-- Patient medical records: notes + treatments.
--
-- Both are child records of a patient, so -- following the exact
-- convention already used by dentist_working_hours/dentist_time_off
-- for records of dentists -- they don't store clinic_id directly.
-- RLS derives clinic scope via patient_id -> patients.clinic_id.
--
-- RLS deliberately mirrors patients/appointments exactly: any active
-- clinic member may select/insert/update, no delete policy (same
-- immutable-history philosophy already applied to those tables).
-- No existing policy is modified.
-- ============================================================

-- ============================================================
-- medical_notes
-- ============================================================
create table medical_notes (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  appointment_id uuid references appointments (id) on delete set null,
  author_id uuid references profiles (id) on delete set null,
  note text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medical_notes_patient_id_idx on medical_notes (patient_id);

create trigger medical_notes_set_updated_at
  before update on medical_notes
  for each row execute function set_updated_at();

-- Cross-reference consistency: appointment_id (when set) must belong
-- to the same patient. security definer so this check sees the
-- ground truth regardless of the calling role's RLS visibility.
create function validate_medical_note_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.appointment_id is not null and not exists (
    select 1 from appointments
    where appointments.id = new.appointment_id
      and appointments.patient_id = new.patient_id
  ) then
    raise exception 'medical_notes.appointment_id must belong to the same patient';
  end if;
  return new;
end;
$$;

create trigger medical_notes_check_consistency
  before insert or update of patient_id, appointment_id on medical_notes
  for each row execute function validate_medical_note_consistency();

alter table medical_notes enable row level security;

create policy medical_notes_select on medical_notes
  for select using (
    patient_id in (select id from patients where clinic_id in (select auth_user_clinic_ids()))
  );

create policy medical_notes_insert on medical_notes
  for insert with check (
    patient_id in (select id from patients where clinic_id in (select auth_user_clinic_ids()))
  );

create policy medical_notes_update on medical_notes
  for update using (
    patient_id in (select id from patients where clinic_id in (select auth_user_clinic_ids()))
  );

-- ============================================================
-- treatments
-- ============================================================
create table treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients (id) on delete cascade,
  dentist_id uuid not null references dentists (id) on delete restrict,
  appointment_id uuid references appointments (id) on delete set null,
  service_id uuid references services (id) on delete set null,
  description text not null,
  tooth_reference text,
  cost numeric(10, 2),
  currency text not null default 'MAD',
  treated_at timestamptz not null default now(),
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index treatments_patient_id_idx on treatments (patient_id);
create index treatments_dentist_id_idx on treatments (dentist_id);

create trigger treatments_set_updated_at
  before update on treatments
  for each row execute function set_updated_at();

-- Cross-reference consistency: dentist_id/service_id must belong to
-- the same clinic as the patient; appointment_id (when set) must
-- belong to the same patient. security definer, same reasoning as
-- validate_appointment_clinic_consistency.
create function validate_treatment_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  patient_clinic_id uuid;
begin
  select clinic_id into patient_clinic_id from patients where id = new.patient_id;

  if not exists (
    select 1 from dentists
    where dentists.id = new.dentist_id
      and dentists.clinic_id = patient_clinic_id
  ) then
    raise exception 'treatments.dentist_id must belong to the same clinic as the patient';
  end if;

  if new.appointment_id is not null and not exists (
    select 1 from appointments
    where appointments.id = new.appointment_id
      and appointments.patient_id = new.patient_id
  ) then
    raise exception 'treatments.appointment_id must belong to the same patient';
  end if;

  if new.service_id is not null and not exists (
    select 1 from services
    where services.id = new.service_id
      and services.clinic_id = patient_clinic_id
  ) then
    raise exception 'treatments.service_id must belong to the same clinic as the patient';
  end if;

  return new;
end;
$$;

create trigger treatments_check_consistency
  before insert or update of patient_id, dentist_id, appointment_id, service_id on treatments
  for each row execute function validate_treatment_consistency();

alter table treatments enable row level security;

create policy treatments_select on treatments
  for select using (
    patient_id in (select id from patients where clinic_id in (select auth_user_clinic_ids()))
  );

create policy treatments_insert on treatments
  for insert with check (
    patient_id in (select id from patients where clinic_id in (select auth_user_clinic_ids()))
  );

create policy treatments_update on treatments
  for update using (
    patient_id in (select id from patients where clinic_id in (select auth_user_clinic_ids()))
  );
