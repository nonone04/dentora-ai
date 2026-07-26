-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "btree_gist";

-- ============================================================
-- Enum types
-- ============================================================
create type clinic_role as enum ('owner', 'admin', 'dentist', 'receptionist');
create type appointment_status as enum ('scheduled', 'confirmed', 'cancelled', 'completed', 'no_show');
create type appointment_source as enum ('staff', 'ai_assistant');
create type patient_source as enum ('staff', 'ai_assistant');

-- ============================================================
-- Shared trigger: keep updated_at current
-- ============================================================
create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- clinics
-- ============================================================
create table clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  whatsapp_number text,
  email text,
  address text,
  city text,
  timezone text not null default 'Africa/Casablanca',
  default_language text not null default 'fr' check (default_language in ('ar', 'fr', 'en')),
  settings jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger clinics_set_updated_at
  before update on clinics
  for each row execute function set_updated_at();

-- ============================================================
-- profiles (1:1 shadow of auth.users)
-- ============================================================
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  preferred_language text not null default 'fr' check (preferred_language in ('ar', 'fr', 'en')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

-- ============================================================
-- clinic_members (identity <-> clinic <-> role)
-- ============================================================
create table clinic_members (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  role clinic_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id, user_id)
);

create index clinic_members_user_id_idx on clinic_members (user_id);
create index clinic_members_clinic_id_idx on clinic_members (clinic_id);

-- ============================================================
-- dentists (schedulable resource; login optional)
-- ============================================================
create table dentists (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  clinic_member_id uuid unique references clinic_members (id) on delete set null,
  full_name text not null,
  specialty text,
  license_number text,
  color text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index dentists_clinic_id_idx on dentists (clinic_id);

create trigger dentists_set_updated_at
  before update on dentists
  for each row execute function set_updated_at();

-- Database-enforced tenancy consistency: a dentist's clinic_id must always
-- match the clinic of the clinic_member it is linked to, when linked.
-- security definer so this check sees the ground truth regardless of the
-- calling role's RLS visibility into clinic_members.
create function validate_dentist_clinic_consistency()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.clinic_member_id is not null and not exists (
    select 1
    from clinic_members
    where clinic_members.id = new.clinic_member_id
      and clinic_members.clinic_id = new.clinic_id
  ) then
    raise exception 'dentists.clinic_member_id must belong to the same clinic_id';
  end if;
  return new;
end;
$$;

create trigger dentists_check_clinic_consistency
  before insert or update of clinic_id, clinic_member_id on dentists
  for each row execute function validate_dentist_clinic_consistency();

-- ============================================================
-- dentist_working_hours (recurring weekly availability)
-- ============================================================
create table dentist_working_hours (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references dentists (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  check (end_time > start_time)
);

create index dentist_working_hours_dentist_id_idx on dentist_working_hours (dentist_id);

-- ============================================================
-- dentist_time_off (vacation / sick leave / absence blocking)
-- ============================================================
create table dentist_time_off (
  id uuid primary key default gen_random_uuid(),
  dentist_id uuid not null references dentists (id) on delete cascade,
  start_at timestamptz not null,
  end_at timestamptz not null,
  reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at)
);

create index dentist_time_off_dentist_id_idx on dentist_time_off (dentist_id);

-- ============================================================
-- services
-- ============================================================
create table services (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  name_translations jsonb not null default '{}'::jsonb,
  default_duration_minutes integer not null default 30 check (default_duration_minutes > 0),
  price numeric(10, 2),
  currency text not null default 'MAD',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index services_clinic_id_idx on services (clinic_id);

create trigger services_set_updated_at
  before update on services
  for each row execute function set_updated_at();

-- ============================================================
-- patients
-- ============================================================
create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  date_of_birth date,
  gender text,
  preferred_language text not null default 'fr' check (preferred_language in ('ar', 'fr', 'en')),
  notes text,
  created_via patient_source not null default 'staff',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index patients_clinic_id_idx on patients (clinic_id);
create unique index patients_clinic_phone_unique
  on patients (clinic_id, phone)
  where phone is not null;

create trigger patients_set_updated_at
  before update on patients
  for each row execute function set_updated_at();

-- ============================================================
-- appointments
-- ============================================================
create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  dentist_id uuid not null references dentists (id) on delete restrict,
  service_id uuid references services (id) on delete set null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status appointment_status not null default 'scheduled',
  source appointment_source not null default 'staff',
  notes text,
  cancellation_reason text,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  appointment_range tstzrange generated always as (tstzrange(start_at, end_at, '[)')) stored,
  check (end_at > start_at)
);

create index appointments_clinic_start_idx on appointments (clinic_id, start_at);
create index appointments_patient_id_idx on appointments (patient_id);
create index appointments_dentist_id_idx on appointments (dentist_id);

-- Database-enforced double-booking prevention: no two non-cancelled
-- appointments for the same dentist may overlap in time.
alter table appointments
  add constraint appointments_no_overlap
  exclude using gist (dentist_id with =, appointment_range with &&)
  where (status <> 'cancelled');

create trigger appointments_set_updated_at
  before update on appointments
  for each row execute function set_updated_at();

-- Database-enforced tenancy consistency: dentist_id, patient_id, and
-- service_id (when set) must all belong to the same clinic_id as the
-- appointment itself. security definer so this check sees the ground truth
-- regardless of the calling role's RLS visibility into those tables.
create function validate_appointment_clinic_consistency()
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
    raise exception 'appointments.dentist_id must belong to the same clinic_id';
  end if;

  if not exists (
    select 1 from patients
    where patients.id = new.patient_id
      and patients.clinic_id = new.clinic_id
  ) then
    raise exception 'appointments.patient_id must belong to the same clinic_id';
  end if;

  if new.service_id is not null and not exists (
    select 1 from services
    where services.id = new.service_id
      and services.clinic_id = new.clinic_id
  ) then
    raise exception 'appointments.service_id must belong to the same clinic_id';
  end if;

  return new;
end;
$$;

create trigger appointments_check_clinic_consistency
  before insert or update of clinic_id, dentist_id, patient_id, service_id on appointments
  for each row execute function validate_appointment_clinic_consistency();

-- Database-enforced time-off blocking: no non-cancelled appointment may be
-- created or moved into a range that overlaps the dentist's recorded time off.
-- security definer so this check sees the ground truth regardless of the
-- calling role's RLS visibility into dentist_time_off.
create function prevent_appointment_during_time_off()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status <> 'cancelled' and exists (
    select 1
    from dentist_time_off
    where dentist_time_off.dentist_id = new.dentist_id
      and tstzrange(dentist_time_off.start_at, dentist_time_off.end_at) && tstzrange(new.start_at, new.end_at)
  ) then
    raise exception 'Dentist is unavailable during this time (time off)';
  end if;
  return new;
end;
$$;

create trigger appointments_check_time_off
  before insert or update of start_at, end_at, dentist_id, status on appointments
  for each row execute function prevent_appointment_during_time_off();

-- ============================================================
-- RLS helper functions
-- ============================================================
create function auth_user_clinic_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select clinic_id
  from clinic_members
  where user_id = auth.uid()
    and is_active = true;
$$;

create function auth_user_has_role(target_clinic_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clinic_members
    where clinic_id = target_clinic_id
      and user_id = auth.uid()
      and is_active = true
      and role::text = any (allowed_roles)
  );
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table clinics enable row level security;
alter table profiles enable row level security;
alter table clinic_members enable row level security;
alter table dentists enable row level security;
alter table dentist_working_hours enable row level security;
alter table dentist_time_off enable row level security;
alter table services enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;

-- clinics
create policy clinics_select on clinics
  for select using (id in (select auth_user_clinic_ids()));

create policy clinics_update on clinics
  for update using (auth_user_has_role(id, array['owner', 'admin']));

-- profiles
create policy profiles_select on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from clinic_members
      where clinic_members.user_id = profiles.id
        and clinic_members.clinic_id in (select auth_user_clinic_ids())
    )
  );

create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());

create policy profiles_update_self on profiles
  for update using (id = auth.uid());

-- clinic_members
create policy clinic_members_select on clinic_members
  for select using (
    user_id = auth.uid()
    or auth_user_has_role(clinic_id, array['owner', 'admin'])
  );

create policy clinic_members_insert on clinic_members
  for insert with check (
    auth_user_has_role(clinic_id, array['owner', 'admin'])
    and (
      role <> 'owner'
      or auth_user_has_role(clinic_id, array['owner'])
    )
  );

create policy clinic_members_update on clinic_members
  for update
  using (auth_user_has_role(clinic_id, array['owner', 'admin']))
  with check (
    auth_user_has_role(clinic_id, array['owner', 'admin'])
    and (
      role <> 'owner'
      or auth_user_has_role(clinic_id, array['owner'])
    )
  );

create policy clinic_members_delete on clinic_members
  for delete using (
    auth_user_has_role(clinic_id, array['owner'])
    or (
      auth_user_has_role(clinic_id, array['admin'])
      and role <> 'owner'
    )
  );

-- dentists
create policy dentists_select on dentists
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy dentists_insert on dentists
  for insert with check (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy dentists_update on dentists
  for update
  using (
    auth_user_has_role(clinic_id, array['owner', 'admin'])
    or clinic_member_id in (select id from clinic_members where user_id = auth.uid())
  )
  with check (
    auth_user_has_role(clinic_id, array['owner', 'admin'])
    or (
      clinic_member_id in (select id from clinic_members where user_id = auth.uid())
      and clinic_id = (
        select clinic_members.clinic_id
        from clinic_members
        where clinic_members.id = dentists.clinic_member_id
      )
    )
  );

-- dentist_working_hours
create policy dentist_working_hours_select on dentist_working_hours
  for select using (
    dentist_id in (select id from dentists where clinic_id in (select auth_user_clinic_ids()))
  );

create policy dentist_working_hours_modify on dentist_working_hours
  for all
  using (
    dentist_id in (
      select d.id from dentists d
      where auth_user_has_role(d.clinic_id, array['owner', 'admin'])
         or d.clinic_member_id in (select id from clinic_members where user_id = auth.uid())
    )
  )
  with check (
    dentist_id in (
      select d.id from dentists d
      where auth_user_has_role(d.clinic_id, array['owner', 'admin'])
         or d.clinic_member_id in (select id from clinic_members where user_id = auth.uid())
    )
  );

-- dentist_time_off
create policy dentist_time_off_select on dentist_time_off
  for select using (
    dentist_id in (select id from dentists where clinic_id in (select auth_user_clinic_ids()))
  );

create policy dentist_time_off_modify on dentist_time_off
  for all
  using (
    dentist_id in (
      select d.id from dentists d
      where auth_user_has_role(d.clinic_id, array['owner', 'admin'])
         or d.clinic_member_id in (select id from clinic_members where user_id = auth.uid())
    )
  )
  with check (
    dentist_id in (
      select d.id from dentists d
      where auth_user_has_role(d.clinic_id, array['owner', 'admin'])
         or d.clinic_member_id in (select id from clinic_members where user_id = auth.uid())
    )
  );

-- services
create policy services_select on services
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy services_modify on services
  for all
  using (auth_user_has_role(clinic_id, array['owner', 'admin']))
  with check (auth_user_has_role(clinic_id, array['owner', 'admin']));

-- patients
create policy patients_select on patients
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy patients_insert on patients
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

create policy patients_update on patients
  for update using (clinic_id in (select auth_user_clinic_ids()));

-- appointments
create policy appointments_select on appointments
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy appointments_insert on appointments
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

create policy appointments_update on appointments
  for update using (clinic_id in (select auth_user_clinic_ids()));
