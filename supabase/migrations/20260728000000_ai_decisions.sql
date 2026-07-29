-- ============================================================
-- AI observability: one row per Decision Engine verdict (lib/ai/
-- decision), run immediately after NLU extraction and ahead of tool
-- selection on every inbound patient message.
--
-- Same shape and rationale as ai_nlu_extractions/ai_turn_events: a
-- top-level clinic resource (direct clinic_id) recording the outcome of
-- an operation rather than being a child of one fixed parent table. RLS
-- mirrors both exactly -- select is owner/admin only (operational
-- telemetry, not general clinic data), every row is system-generated
-- (written via the admin client from the orchestrator, no authenticated
-- user in the loop), and there is no update or delete policy --
-- decision events are immutable. No existing policy anywhere else is
-- modified.
-- ============================================================

create type ai_decision_kind as enum (
  'ask_follow_up',
  'execute_tool',
  'escalate_to_staff',
  'emergency_workflow',
  'reply_directly'
);

create table ai_decisions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  conversation_id uuid references ai_conversations (id) on delete set null,
  decision_kind ai_decision_kind not null,
  reason text not null,
  intent ai_nlu_intent not null,
  urgency ai_nlu_urgency not null,
  confidence numeric(3, 2) not null check (confidence >= 0 and confidence <= 1),
  missing_fields text[] not null default '{}',
  latency_ms int not null,
  model text,
  created_at timestamptz not null default now()
);

create index ai_decisions_clinic_id_idx on ai_decisions (clinic_id, created_at desc);
create index ai_decisions_conversation_id_idx on ai_decisions (conversation_id);

alter table ai_decisions enable row level security;

create policy ai_decisions_select on ai_decisions
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy ai_decisions_insert on ai_decisions
  for insert with check (clinic_id in (select auth_user_clinic_ids()));
