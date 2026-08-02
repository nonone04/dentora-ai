-- ============================================================
-- Subscription-first access control.
--
-- One row per Stripe Subscription, keyed to the *paying user*, not a
-- clinic -- in the subscription-first flow, Checkout's
-- client_reference_id is a user id and payment happens before any
-- clinic exists. "The clinic's subscription" is always derivable by
-- joining clinic_members(role='owner') -> subscriptions.user_id, so
-- there's no separate clinic_id column here to ever drift out of sync.
-- ============================================================
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text not null unique,
  plan text not null check (plan in ('standard', 'professional')),
  -- Deliberately not a fixed enum: Stripe's own Subscription.Status type
  -- reserves room for future values. "Active" is decided in application
  -- code (lib/stripe/subscriptions.ts#isActiveSubscriptionStatus), not here.
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_id_idx on subscriptions (user_id);

create trigger subscriptions_set_updated_at
  before update on subscriptions
  for each row execute function set_updated_at();

alter table subscriptions enable row level security;

-- Owner reads their own billing row only. No insert/update/delete policy
-- on purpose -- RLS default-denies those; all writes happen through the
-- service-role client (Stripe webhook / billing/success reconciliation),
-- which bypasses RLS entirely.
create policy subscriptions_select_own on subscriptions
  for select using (user_id = auth.uid());

-- ============================================================
-- clinic_has_active_subscription: the single access-control read path
-- used by every protected clinic route (app/clinic/[clinicId]/layout.tsx).
-- Security definer (same pattern as create_clinic_with_owner /
-- accept_clinic_invitation) because it joins clinic_members ->
-- subscriptions across a row a staff caller has no RLS visibility into
-- (subscriptions_select_own only exposes user_id = auth.uid(), and staff
-- are not the owner). Scoped to callers who are themselves an active
-- member of target_clinic_id, so an authenticated stranger can't probe
-- an arbitrary clinic id's billing status.
-- ============================================================
create function clinic_has_active_subscription(target_clinic_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from clinic_members caller
    join clinic_members owner
      on owner.clinic_id = caller.clinic_id
     and owner.role = 'owner'
     and owner.is_active = true
    join subscriptions s on s.user_id = owner.user_id
    where caller.clinic_id = target_clinic_id
      and caller.user_id = auth.uid()
      and caller.is_active = true
      and s.status in ('trialing', 'active')
  );
$$;

revoke execute on function clinic_has_active_subscription(uuid) from public;
grant execute on function clinic_has_active_subscription(uuid) to authenticated;

-- ============================================================
-- Defense in depth: create_clinic_with_owner now also requires the
-- caller to already have an active subscription. The page-level check
-- in app/page.tsx is UX only (redirects before the form even renders)
-- -- this is the authoritative gate against a stale tab or a direct RPC
-- call after a subscription lapses. create or replace preserves the
-- grants from the original migration (20260726120000).
-- ============================================================
create or replace function create_clinic_with_owner(clinic_name text, clinic_slug text)
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

  if not exists (
    select 1 from subscriptions
    where user_id = auth.uid() and status in ('trialing', 'active')
  ) then
    raise exception 'An active subscription is required to create a clinic';
  end if;

  insert into clinics (name, slug)
  values (trim(clinic_name), clinic_slug)
  returning id into new_clinic_id;

  insert into clinic_members (clinic_id, user_id, role, is_active)
  values (new_clinic_id, auth.uid(), 'owner', true);

  return new_clinic_id;
end;
$$;
