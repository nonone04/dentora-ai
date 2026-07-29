-- ============================================================
-- AI observability: one row per proactive Availability Engine query
-- (lib/ai/availability), run immediately after the Conversation State
-- layer on every appointment-related turn that already has a date.
--
-- Same shape and rationale as ai_nlu_extractions/ai_decisions: a
-- top-level clinic resource (direct clinic_id) recording the outcome of
-- an operation rather than being a child of one fixed parent table. RLS
-- mirrors both exactly -- select is owner/admin only (operational
-- telemetry, not general clinic data), every row is system-generated
-- (written via the admin client from the orchestrator, no authenticated
-- user in the loop), and there is no update or delete policy -- query
-- events are immutable. No existing policy anywhere else is modified.
-- ============================================================

create table ai_availability_queries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  conversation_id uuid references ai_conversations (id) on delete set null,
  requested_date date not null,
  service_id uuid references services (id) on delete set null,
  dentist_id uuid references dentists (id) on delete set null,
  options_count int not null default 0,
  conflicts jsonb not null default '[]'::jsonb,
  fallback_count int not null default 0,
  fallback_date date,
  latency_ms int not null,
  created_at timestamptz not null default now()
);

create index ai_availability_queries_clinic_id_idx on ai_availability_queries (clinic_id, created_at desc);
create index ai_availability_queries_conversation_id_idx on ai_availability_queries (conversation_id);

alter table ai_availability_queries enable row level security;

create policy ai_availability_queries_select on ai_availability_queries
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy ai_availability_queries_insert on ai_availability_queries
  for insert with check (clinic_id in (select auth_user_clinic_ids()));
