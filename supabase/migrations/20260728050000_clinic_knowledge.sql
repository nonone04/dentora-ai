-- ============================================================
-- Clinic Knowledge Engine (lib/ai/knowledge): a versioned, categorized
-- knowledge store with a deterministic retrieval layer on top, so the
-- orchestrator can inject only the handful of records relevant to a
-- patient's actual question instead of the clinic's whole profile.
--
-- Deliberately a NEW, independent system alongside the existing
-- knowledge_base_entries table (still powering lib/ai/tools/
-- get-clinic-info.ts unchanged) rather than modifying or migrating it --
-- knowledge_base_entries has no versioning and a free-text category, and
-- rebuilding it in place would risk existing behavior for clinics that
-- already rely on it. Clinics adopt the new structured system by adding
-- records to it; until they do, retrieval simply returns no matches
-- (the engine's own fallback path -- see lib/ai/knowledge/engine.ts).
-- ============================================================

create type clinic_knowledge_category as enum (
  'services',
  'pricing',
  'hours',
  'insurance',
  'payment_methods',
  'parking',
  'cancellation_policy',
  'faq',
  'emergency'
);

-- ============================================================
-- clinic_knowledge_records: the current version of each knowledge
-- record. Same shape/rationale as knowledge_base_entries -- top-level
-- clinic resource, curated clinic content rather than a personal
-- record -- so RLS mirrors it exactly: any active member reads,
-- owner/admin manages (insert/update/delete). This is the "admin-facing
-- API" surface (app/actions/knowledge.ts) writes to.
-- ============================================================
create table clinic_knowledge_records (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  category clinic_knowledge_category not null,
  title text not null,
  content text not null,
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  -- Optimistic concurrency, same compare-and-swap pattern used
  -- throughout lib/ai -- app/actions/knowledge.ts's updateKnowledgeRecord
  -- CAS-updates on this column and bumps it on every successful write.
  version int not null default 1,
  created_by uuid references profiles (id) on delete set null,
  updated_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinic_knowledge_records_clinic_id_idx on clinic_knowledge_records (clinic_id);
create index clinic_knowledge_records_clinic_category_idx on clinic_knowledge_records (clinic_id, category);

create trigger clinic_knowledge_records_set_updated_at
  before update on clinic_knowledge_records
  for each row execute function set_updated_at();

alter table clinic_knowledge_records enable row level security;

create policy clinic_knowledge_records_select on clinic_knowledge_records
  for select using (clinic_id in (select auth_user_clinic_ids()));

create policy clinic_knowledge_records_modify on clinic_knowledge_records
  for all
  using (auth_user_has_role(clinic_id, array['owner', 'admin']))
  with check (auth_user_has_role(clinic_id, array['owner', 'admin']));

-- ============================================================
-- clinic_knowledge_record_versions: immutable snapshot history -- one
-- row per version a record has ever had, written alongside every
-- create/update in lib/ai/knowledge/store.ts. Audit-style telemetry
-- (who changed what, when, and why), so RLS is owner/admin-only for
-- select, matching ai_turn_events/ai_decisions -- not the broader
-- any-active-member shape the current record above gets. No update/
-- delete -- immutable.
-- ============================================================
create table clinic_knowledge_record_versions (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references clinic_knowledge_records (id) on delete cascade,
  clinic_id uuid not null references clinics (id) on delete cascade,
  version int not null,
  category clinic_knowledge_category not null,
  title text not null,
  content text not null,
  keywords text[] not null default '{}',
  is_active boolean not null default true,
  changed_by uuid references profiles (id) on delete set null,
  change_reason text,
  created_at timestamptz not null default now(),
  unique (record_id, version)
);

create index clinic_knowledge_record_versions_record_id_idx on clinic_knowledge_record_versions (record_id, version desc);

alter table clinic_knowledge_record_versions enable row level security;

create policy clinic_knowledge_record_versions_select on clinic_knowledge_record_versions
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy clinic_knowledge_record_versions_insert on clinic_knowledge_record_versions
  for insert with check (clinic_id in (select auth_user_clinic_ids()));

-- ============================================================
-- clinic_knowledge_searches: one row per retrieval attempt -- analytics
-- for search hits/misses (lib/ai/knowledge/log.ts). Same shape as
-- ai_availability_queries/ai_nlu_extractions: owner/admin-only select
-- (operational telemetry), insert allowed to any active clinic member
-- (written via the AI orchestrator's admin client), no update/delete.
-- ============================================================
create table clinic_knowledge_searches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references clinics (id) on delete cascade,
  conversation_id uuid references ai_conversations (id) on delete set null,
  query text not null,
  category clinic_knowledge_category,
  hit boolean not null,
  matched_record_ids uuid[] not null default '{}',
  top_score numeric(6, 2),
  latency_ms int not null,
  created_at timestamptz not null default now()
);

create index clinic_knowledge_searches_clinic_id_idx on clinic_knowledge_searches (clinic_id, created_at desc);

alter table clinic_knowledge_searches enable row level security;

create policy clinic_knowledge_searches_select on clinic_knowledge_searches
  for select using (auth_user_has_role(clinic_id, array['owner', 'admin']));

create policy clinic_knowledge_searches_insert on clinic_knowledge_searches
  for insert with check (clinic_id in (select auth_user_clinic_ids()));
