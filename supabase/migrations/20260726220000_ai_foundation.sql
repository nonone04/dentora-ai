-- ============================================================
-- AI foundation layer: knowledge base + conversation logging.
--
-- No AI integration happens here -- these tables exist so a future
-- AI integration has somewhere correct to read from (knowledge base)
-- and write to (conversations/messages). Nothing in this migration
-- calls out to any external service, and no existing RLS policy
-- anywhere else is modified.
-- ============================================================

-- ============================================================
-- knowledge_base_entries: top-level clinic resource (direct
-- clinic_id), same shape as services -- curated clinic content/
-- policy, not a personal record, so RLS mirrors services_modify
-- exactly: any active member reads, owner/admin manages (insert/
-- update/delete).
-- ============================================================
create table knowledge_base_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  category text,
  question text not null,
  answer text not null,
  is_active boolean not null default true,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index knowledge_base_entries_clinic_id_idx on knowledge_base_entries (clinic_id);

create trigger knowledge_base_entries_set_updated_at
  before update on knowledge_base_entries
  for each row execute function set_updated_at();

alter table knowledge_base_entries enable row level security;

create policy knowledge_base_entries_select on knowledge_base_entries
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy knowledge_base_entries_modify on knowledge_base_entries
  for all
  using (auth_user_has_role(clinic_id, array['owner', 'admin']))
  with check (auth_user_has_role(clinic_id, array['owner', 'admin']));

-- ============================================================
-- ai_conversations / ai_messages: conversation logging foundation.
--
-- ai_conversations is top-level (direct clinic_id). ai_messages is
-- a child record of a conversation -- same convention already used
-- by medical_notes/treatments/notifications -- so it derives clinic
-- scope via conversation_id rather than storing clinic_id directly.
-- ============================================================
create type ai_conversation_channel as enum ('whatsapp', 'web_chat', 'sms');
create type ai_conversation_status as enum ('active', 'resolved', 'escalated', 'abandoned');
create type ai_message_role as enum ('user', 'assistant', 'system');

create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  patient_id uuid references patients (id) on delete set null,
  channel ai_conversation_channel not null,
  status ai_conversation_status not null default 'active',
  external_thread_id text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_clinic_id_idx on ai_conversations (clinic_id, started_at desc);
create index ai_conversations_patient_id_idx on ai_conversations (patient_id);

create trigger ai_conversations_set_updated_at
  before update on ai_conversations
  for each row execute function set_updated_at();

alter table ai_conversations enable row level security;

create policy ai_conversations_select on ai_conversations
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy ai_conversations_insert on ai_conversations
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

create policy ai_conversations_update on ai_conversations
  for update using (clinic_id in (select auth_user_clinic_ids()));

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations (id) on delete cascade,
  role ai_message_role not null,
  content text not null,
  ai_action text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_messages_conversation_id_idx on ai_messages (conversation_id, created_at);

alter table ai_messages enable row level security;

-- select/insert only -- a transcript being editable after the fact
-- would defeat the point of a log. No update, no delete.
create policy ai_messages_select on ai_messages
  for select using (
    conversation_id in (select id from ai_conversations where clinic_id in (select auth_user_clinic_ids()))
  );

create policy ai_messages_insert on ai_messages
  for insert with check (
    conversation_id in (select id from ai_conversations where clinic_id in (select auth_user_clinic_ids()))
  );
