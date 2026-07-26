-- ============================================================
-- AI observability: one row per orchestrator turn (Phase 14B).
--
-- ai_turn_events is a top-level clinic resource (direct clinic_id),
-- same rationale as audit_logs -- it records outcomes of an
-- operation (an LLM turn) rather than being a child of one fixed
-- parent table. RLS mirrors audit_logs exactly: select is owner/admin
-- only (operational telemetry, not general clinic data), and there is
-- no insert policy restricting the actor because every row here is
-- system-generated (written via the admin client from the
-- orchestrator, which has no authenticated user in the loop -- same
-- reasoning as ai_messages already being written that way). No
-- update or delete policy -- turn events are immutable, like audit
-- logs. No existing policy anywhere else is modified.
-- ============================================================

create type ai_turn_outcome as enum ('reply', 'tool_calls_exhausted', 'llm_error', 'escalated');

create table ai_turn_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  conversation_id uuid references ai_conversations (id) on delete set null,
  outcome ai_turn_outcome not null,
  iteration_count int not null default 0,
  tool_calls jsonb not null default '[]'::jsonb,
  input_tokens int,
  output_tokens int,
  latency_ms int not null,
  model text,
  created_at timestamptz not null default now()
);

create index ai_turn_events_clinic_id_idx on ai_turn_events (clinic_id, created_at desc);
create index ai_turn_events_conversation_id_idx on ai_turn_events (conversation_id);

alter table ai_turn_events enable row level security;

create policy ai_turn_events_select on ai_turn_events
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy ai_turn_events_insert on ai_turn_events
  for insert with check (clinic_id in (select auth_user_clinic_ids()));
