-- ============================================================
-- Track who invited each clinic_members row, so the "Invitation
-- Accepted" branded email (lib/email/templates/invitation-accepted.ts)
-- can notify the actual inviter once a pending invite is accepted.
-- Nullable, no backfill for existing rows (we don't know who invited
-- them) -- those rows simply won't produce a notification, which is
-- fine for a purely additive, best-effort feature.
-- ============================================================

alter table clinic_members add column invited_by uuid references profiles(id);

-- Widened to also return invited_by (previously just clinic_id) so the
-- caller (app/actions/team.ts's acceptInvitation) can look up the
-- inviter to notify, without a second privileged query.
create or replace function accept_clinic_invitation(membership_id uuid)
returns table (clinic_id uuid, invited_by uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  target_clinic_id uuid;
  target_invited_by uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update clinic_members
  set is_active = true
  where id = membership_id
    and user_id = auth.uid()
    and is_active = false
  returning clinic_id, invited_by into target_clinic_id, target_invited_by;

  if target_clinic_id is null then
    raise exception 'Invitation not found';
  end if;

  return query select target_clinic_id, target_invited_by;
end;
$$;

revoke execute on function accept_clinic_invitation(uuid) from public;
grant execute on function accept_clinic_invitation(uuid) to authenticated;
