-- ============================================================
-- create_clinic_with_owner: self-serve clinic onboarding.
--
-- clinics has no insert policy, and clinic_members_insert requires
-- the caller to already be an owner/admin of the target clinic -- by
-- design, only existing admins can add members. That leaves no RLS
-- path for a brand new clinic's first (owner) membership to be
-- created. This function is the single, narrow, audited exception:
-- security definer so it can perform both inserts atomically,
-- scoped to auth.uid() only (never an arbitrary user), and it
-- refuses to run for a user who already has an active clinic.
-- ============================================================
create function create_clinic_with_owner(clinic_name text, clinic_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_clinic_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if clinic_name is null or length(trim(clinic_name)) = 0 then
    raise exception 'Clinic name is required';
  end if;

  if clinic_slug is null or length(trim(clinic_slug)) = 0 then
    raise exception 'Clinic slug is required';
  end if;

  if exists (
    select 1 from clinic_members
    where user_id = auth.uid() and is_active = true
  ) then
    raise exception 'You already belong to a clinic';
  end if;

  insert into clinics (name, slug)
  values (trim(clinic_name), clinic_slug)
  returning id into new_clinic_id;

  insert into clinic_members (clinic_id, user_id, role, is_active)
  values (new_clinic_id, auth.uid(), 'owner', true);

  return new_clinic_id;
end;
$$;

revoke execute on function create_clinic_with_owner(text, text) from public;
grant execute on function create_clinic_with_owner(text, text) to authenticated;
