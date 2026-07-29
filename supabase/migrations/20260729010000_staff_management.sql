-- ============================================================
-- Staff Management: suspension + ownership transfer.
--
-- clinic_members.is_active already doubles as "pending invitation"
-- (see 20260726140000_team_invitations.sql) -- suspending a member
-- also sets is_active = false (immediately revoking access via
-- auth_user_clinic_ids/auth_user_has_role, both of which already
-- filter on is_active = true), so a nullable suspended_at is the only
-- new column needed to tell "pending" (suspended_at is null) apart
-- from "suspended" (suspended_at is set) in the UI. Purely additive;
-- no existing column, policy, or RLS helper is touched.
-- ============================================================

alter table clinic_members add column suspended_at timestamptz;

-- ============================================================
-- transfer_clinic_ownership: atomic owner swap, same SECURITY DEFINER
-- pattern as create_clinic_with_owner / accept_clinic_invitation. The
-- existing clinic_members_update RLS policy already lets an owner set
-- someone else's role to 'owner' and demote their own row via two
-- separate UPDATEs, but only a single transaction guarantees the
-- clinic is never left with the new owner promoted while the old
-- owner hasn't yet stepped down (or vice versa on a partial failure).
-- ============================================================
create function transfer_clinic_ownership(target_clinic_id uuid, new_owner_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_member_id uuid;
  target_member_clinic_id uuid;
  target_member_active boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select id into caller_member_id
  from clinic_members
  where clinic_id = target_clinic_id
    and user_id = auth.uid()
    and is_active = true
    and role = 'owner';

  if caller_member_id is null then
    raise exception 'Only the clinic owner can transfer ownership';
  end if;

  select clinic_id, is_active into target_member_clinic_id, target_member_active
  from clinic_members
  where id = new_owner_member_id;

  if target_member_clinic_id is null or target_member_clinic_id <> target_clinic_id then
    raise exception 'Target member not found in this clinic';
  end if;

  if not target_member_active then
    raise exception 'Cannot transfer ownership to an inactive member';
  end if;

  if new_owner_member_id = caller_member_id then
    raise exception 'You are already the owner';
  end if;

  update clinic_members set role = 'owner' where id = new_owner_member_id;
  update clinic_members set role = 'admin' where id = caller_member_id;
end;
$$;

revoke execute on function transfer_clinic_ownership(uuid, uuid) from public;
grant execute on function transfer_clinic_ownership(uuid, uuid) to authenticated;
