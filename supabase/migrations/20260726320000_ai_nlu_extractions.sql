-- ============================================================
-- AI observability: one row per NLU extraction (structured intent/
-- entity/urgency/language parse), run ahead of tool selection on every
-- inbound patient message -- see lib/ai/nlu.
--
-- Same shape and rationale as ai_turn_events: a top-level clinic
-- resource (direct clinic_id) recording the outcome of an operation
-- rather than being a child of one fixed parent table. RLS mirrors
-- ai_turn_events exactly -- select is owner/admin only (operational
-- telemetry, not general clinic data), every row is system-generated
-- (written via the admin client from the orchestrator, no authenticated
-- user in the loop), and there is no update or delete policy --
-- extraction events are immutable, like turn events and audit logs. No
-- existing policy anywhere else is modified.
-- ============================================================

create type ai_nlu_intent as enum (
  'book_appointment',
  'reschedule_appointment',
  'cancel_appointment',
  'check_availability',
  'ask_faq',
  'get_clinic_info',
  'escalate_to_staff',
  'greeting',
  'other'
);

create type ai_nlu_urgency as enum ('low', 'medium', 'high', 'emergency');

-- Matches clinics.default_language / patients.preferred_language's
-- ('ar', 'fr', 'en') check constraint, plus 'other' for anything
-- outside that set.
create type ai_nlu_language as enum ('ar', 'fr', 'en', 'other');

create table ai_nlu_extractions (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  conversation_id uuid references ai_conversations (id) on delete set null,
  intent ai_nlu_intent not null,
  entities jsonb not null default '{}'::jsonb,
  urgency ai_nlu_urgency not null,
  language ai_nlu_language not null,
  confidence numeric(3, 2) not null check (confidence >= 0 and confidence <= 1),
  missing_fields text[] not null default '{}',
  latency_ms int not null,
  model text,
  created_at timestamptz not null default now()
);

create index ai_nlu_extractions_clinic_id_idx on ai_nlu_extractions (clinic_id, created_at desc);
create index ai_nlu_extractions_conversation_id_idx on ai_nlu_extractions (conversation_id);

alter table ai_nlu_extractions enable row level security;

create policy ai_nlu_extractions_select on ai_nlu_extractions
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy ai_nlu_extractions_insert on ai_nlu_extractions
  for insert with check (clinic_id in (select auth_user_clinic_ids()));
