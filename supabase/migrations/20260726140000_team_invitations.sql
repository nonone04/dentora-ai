-- ============================================================
-- Team invitations support.
--
-- clinic_members.user_id is NOT NULL (FK to profiles), so there is
-- no way to represent a "pending, not-yet-a-user" invitation as a
-- clinic_members row until the invitee has a profiles row. We reuse
-- the existing is_active flag instead: a clinic_members row with
-- is_active = false *is* the pending invitation (no new table).
--
-- Three structural gaps block a self-service accept/lookup flow
-- under the *existing* RLS policies, none of which are touched here:
--   1. profiles has no email column, so an inviter can't look up
--      "does this email already have an account" -- profiles_select
--      also only exposes profiles of people who already share a
--      clinic with the caller, which an invitee-to-be does not yet.
--   2. clinic_members_update requires the caller to already be
--      owner/admin (auth_user_has_role, which itself requires
--      is_active = true) -- an invitee whose own row is still
--      is_active = false can never satisfy it, so they can't
--      self-accept via a normal UPDATE.
--   3. clinics_select requires active membership, so an invitee
--      can't see the name of a clinic they've only been invited to.
--
-- Each gap gets one narrow, audited SECURITY DEFINER function
-- (same pattern as create_clinic_with_owner from Phase 0) rather
-- than a change to any existing policy.
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles.email, kept in sync at account-creation time only.
-- ------------------------------------------------------------
alter table profiles add column email text;

update profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Email -> profile id lookup, for the invite flow only.
--    Returns nothing but an opaque id; never exposes profile data.
-- ------------------------------------------------------------
create function find_profile_id_by_email(lookup_email text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from profiles where email = lookup_email limit 1;
$$;

revoke execute on function find_profile_id_by_email(text) from public;
grant execute on function find_profile_id_by_email(text) to authenticated;

-- ------------------------------------------------------------
-- 3. Self-accept: caller can only ever flip their OWN pending row.
-- ------------------------------------------------------------
create function accept_clinic_invitation(membership_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_clinic_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update clinic_members
  set is_active = true
  where id = membership_id
    and user_id = auth.uid()
    and is_active = false
  returning clinic_id into target_clinic_id;

  if target_clinic_id is null then
    raise exception 'Invitation not found';
  end if;

  return target_clinic_id;
end;
$$;

revoke execute on function accept_clinic_invitation(uuid) from public;
grant execute on function accept_clinic_invitation(uuid) to authenticated;

-- ------------------------------------------------------------
-- 4. List the current user's own pending invitations, with the
--    clinic name they'd otherwise have no RLS path to see.
-- ------------------------------------------------------------
create function get_pending_invitations()
returns table (
  membership_id uuid,
  clinic_id uuid,
  clinic_name text,
  role clinic_role,
  invited_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select cm.id, cm.clinic_id, c.name, cm.role, cm.created_at
  from clinic_members cm
  join clinics c on c.id = cm.clinic_id
  where cm.user_id = auth.uid()
    and cm.is_active = false;
$$;

revoke execute on function get_pending_invitations() from public;
grant execute on function get_pending_invitations() to authenticated;
