-- ============================================================
-- Conversation State Engine: persisted, accumulated per-conversation
-- slot-filling state (lib/ai/state) -- one row per ai_conversations
-- row. Updated once per orchestrator turn, immediately after NLU
-- extraction + Decision Engine routing, so multi-turn slot-filling
-- (e.g. "book a cleaning" then, next turn, "tomorrow") accumulates
-- correctly instead of every turn re-deriving from scratch.
--
-- Top-level clinic resource (direct clinic_id) with a 1:1 relationship
-- to ai_conversations via a unique conversation_id -- an operational
-- working record much like ai_conversations itself, so RLS mirrors it
-- exactly (unlike the append-only observability tables ai_turn_events/
-- ai_nlu_extractions/ai_decisions, which are owner/admin-only and
-- insert-only): any active clinic member may select/insert/update, no
-- delete. No existing policy anywhere else is modified.
-- ============================================================

create type conversation_state_status as enum ('active', 'collecting', 'ready', 'escalated');

create table conversation_states (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  status conversation_state_status not null default 'active',
  intent ai_nlu_intent not null default 'other',
  entities jsonb not null default '{}'::jsonb,
  urgency ai_nlu_urgency not null default 'low',
  language ai_nlu_language not null default 'other',
  confidence numeric(3, 2) not null default 0 check (confidence >= 0 and confidence <= 1),
  missing_fields text[] not null default '{}',
  turn_count int not null default 0,
  last_message text,
  -- Optimistic concurrency: lib/ai/state/store.ts's persistConversationState
  -- does a compare-and-swap on this column so two concurrent turns for the
  -- same conversation (e.g. a duplicate webhook delivery) can't silently
  -- clobber each other's merge.
  version int not null default 1,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id)
);

create index conversation_states_clinic_id_idx on conversation_states (clinic_id, updated_at desc);

create trigger conversation_states_set_updated_at
  before update on conversation_states
  for each row execute function set_updated_at();

alter table conversation_states enable row level security;

create policy conversation_states_select on conversation_states
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy conversation_states_insert on conversation_states
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

create policy conversation_states_update on conversation_states
  for update using (clinic_id in (select auth_user_clinic_ids()));
