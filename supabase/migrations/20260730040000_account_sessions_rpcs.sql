-- ============================================================
-- Self-service session listing/revocation.
--
-- supabase-js's public GoTrueAdminApi has no per-session-id revoke
-- and no "list this user's sessions" call -- only signOut with scope
-- 'global' | 'local' | 'others' (auth-js v2.110, GoTrueClient.d.ts).
-- 'others' already covers "revoke all other sessions" with no RPC
-- needed (see lib/auth/sessions.ts). A per-device "revoke just this
-- one" UI has no public API path, so it's implemented here against
-- GoTrue's own auth.sessions / auth.refresh_tokens tables, following
-- the same narrow SECURITY DEFINER pattern already used for
-- get_pending_invitations (20260726140000_team_invitations.sql).
--
-- Caveat: auth.sessions / auth.refresh_tokens are GoTrue's internal
-- schema, not a documented public contract -- same accepted-tradeoff
-- posture as lib/ai/rate-limit.ts's in-memory limiter. If a future
-- Supabase/GoTrue upgrade renames these columns, these two functions
-- are what needs revisiting.
-- ============================================================

create function list_my_sessions()
returns table (
  id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text,
  not_after timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.created_at, s.updated_at, s.user_agent, s.ip::text, s.not_after
  from auth.sessions s
  where s.user_id = auth.uid()
  order by s.updated_at desc nulls last, s.created_at desc;
$$;

revoke execute on function list_my_sessions() from public;
grant execute on function list_my_sessions() to authenticated;

create function revoke_my_session(target_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  owned boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select exists(
    select 1 from auth.sessions where id = target_session_id and user_id = auth.uid()
  ) into owned;

  if not owned then
    return false;
  end if;

  -- Belt-and-suspenders: explicitly drop refresh tokens tied to this
  -- session before deleting the session row, rather than relying on
  -- an assumed cascade that hasn't been verified against the live
  -- schema in this environment.
  delete from auth.refresh_tokens where session_id = target_session_id;
  delete from auth.sessions where id = target_session_id and user_id = auth.uid();

  return true;
end;
$$;

revoke execute on function revoke_my_session(uuid) from public;
grant execute on function revoke_my_session(uuid) to authenticated;
