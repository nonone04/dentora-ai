-- ============================================================
-- clinic_api_keys: staff-managed API keys for future clinic
-- integrations (Staff Management module). No consuming API exists
-- yet -- this is purely the issuance/storage/revocation side. Only a
-- SHA-256 hash of the secret is ever stored; the plaintext secret is
-- generated server-side and returned to the caller exactly once at
-- creation time, then discarded. A top-level clinic resource (like
-- audit_logs), owner/admin only -- same operational-telemetry-adjacent
-- posture as the ai_* observability tables. No delete policy: a
-- revoked key is marked via revoked_at rather than removed, so the
-- issuance history stays auditable, matching audit_logs/
-- appointment_lifecycle_events' own immutable-record convention. No
-- existing table, column, or policy is touched.
-- ============================================================

create table clinic_api_keys (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  name text not null,
  -- Short, non-secret prefix shown in the UI so staff can tell keys
  -- apart at a glance (e.g. "dta_live_ab12...") -- never enough to
  -- reconstruct the secret.
  key_prefix text not null,
  key_hash text not null,
  created_by uuid references profiles (id) on delete set null,
  last_used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index clinic_api_keys_clinic_id_idx on clinic_api_keys (clinic_id, created_at desc);
create unique index clinic_api_keys_key_hash_idx on clinic_api_keys (key_hash);

alter table clinic_api_keys enable row level security;

create policy clinic_api_keys_select on clinic_api_keys
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy clinic_api_keys_insert on clinic_api_keys
  for insert with check (auth_user_has_role(clinic_id, array['owner', 'admin']));

-- Update is scoped to revocation (revoked_at) in practice, enforced at
-- the application layer -- RLS just gates "an owner/admin of this
-- clinic", matching every other owner/admin-modify policy in this
-- schema (services_modify, dentists_insert, etc.).
create policy clinic_api_keys_update on clinic_api_keys
  for update
  using (auth_user_has_role(clinic_id, array['owner', 'admin']))
  with check (auth_user_has_role(clinic_id, array['owner', 'admin']));
