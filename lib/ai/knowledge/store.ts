import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeCategory, KnowledgeRecord, KnowledgeRecordVersion } from "@/lib/ai/knowledge/types";
import {
  parseKnowledgeRecordRow,
  parseKnowledgeRecordVersionRow,
  type KnowledgeRecordRow,
  type KnowledgeRecordVersionRow,
} from "@/lib/ai/knowledge/validate";

export type StoreOutcome<T> =
  | { ok: true; record: T }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "conflict" }
  | { ok: false; reason: "forbidden" };

/**
 * Best-effort: a failure here means the record itself was written
 * successfully but its history entry wasn't -- logged, never thrown,
 * since losing one version snapshot shouldn't undo (or appear to fail)
 * an otherwise-successful create/update for the staff member who just
 * made it.
 */
async function recordVersionSnapshot(
  supabase: SupabaseClient,
  record: KnowledgeRecord,
  meta: { changedBy: string | null; changeReason: string | null },
): Promise<void> {
  const { error } = await supabase.from("clinic_knowledge_record_versions").insert({
    record_id: record.id,
    clinic_id: record.clinicId,
    version: record.version,
    category: record.category,
    title: record.title,
    content: record.content,
    keywords: record.keywords,
    is_active: record.isActive,
    changed_by: meta.changedBy,
    change_reason: meta.changeReason,
  });
  if (error) console.error("[ai:knowledge] failed to record version snapshot", error.message);
}

async function getRecord(supabase: SupabaseClient, clinicId: string, recordId: string): Promise<KnowledgeRecord | null> {
  const { data } = await supabase.from("clinic_knowledge_records").select("*").eq("id", recordId).eq("clinic_id", clinicId).maybeSingle();
  return data ? parseKnowledgeRecordRow(data as KnowledgeRecordRow) : null;
}

/**
 * Creates a new knowledge record at version 1, plus its initial version
 * snapshot -- the admin-facing entry point for adding new clinic
 * knowledge (app/actions/knowledge.ts) without touching any prompt.
 * Takes a generic SupabaseClient (not the admin client) so it runs under
 * the calling staff member's own RLS-respecting session -- an insert
 * from anyone who isn't owner/admin is rejected by
 * clinic_knowledge_records_modify and surfaces here as "forbidden".
 */
export async function createKnowledgeRecord(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    category: KnowledgeCategory;
    title: string;
    content: string;
    keywords?: string[];
    actorId?: string | null;
  },
): Promise<StoreOutcome<KnowledgeRecord>> {
  const { data, error } = await supabase
    .from("clinic_knowledge_records")
    .insert({
      clinic_id: params.clinicId,
      category: params.category,
      title: params.title,
      content: params.content,
      keywords: params.keywords ?? [],
      version: 1,
      created_by: params.actorId ?? null,
      updated_by: params.actorId ?? null,
    })
    .select()
    .maybeSingle();

  if (error || !data) return { ok: false, reason: "forbidden" };

  const record = parseKnowledgeRecordRow(data as KnowledgeRecordRow);
  await recordVersionSnapshot(supabase, record, { changedBy: params.actorId ?? null, changeReason: "created" });
  return { ok: true, record };
}

/**
 * Updates a record via compare-and-swap on `expectedVersion` -- staff
 * loaded the record at some version, edited it, and submit expecting
 * that exact version to still be current. Unlike the AI engines'
 * stores elsewhere in lib/ai (which auto-retry a lost race), this does
 * NOT retry: a human editing a document expects "someone else changed
 * this, please reload" on conflict, not a silent overwrite of intent
 * they never saw. Distinguishes three ways a write can fail: the record
 * is gone (not_found), someone else's edit landed first (conflict), or
 * RLS rejected the write outright because the actor isn't owner/admin
 * even though the version matched (forbidden).
 */
export async function updateKnowledgeRecord(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    recordId: string;
    expectedVersion: number;
    patch: Partial<{ category: KnowledgeCategory; title: string; content: string; keywords: string[]; isActive: boolean }>;
    actorId?: string | null;
    changeReason?: string | null;
  },
): Promise<StoreOutcome<KnowledgeRecord>> {
  const updatePayload: Record<string, unknown> = { version: params.expectedVersion + 1, updated_by: params.actorId ?? null };
  if (params.patch.category !== undefined) updatePayload.category = params.patch.category;
  if (params.patch.title !== undefined) updatePayload.title = params.patch.title;
  if (params.patch.content !== undefined) updatePayload.content = params.patch.content;
  if (params.patch.keywords !== undefined) updatePayload.keywords = params.patch.keywords;
  if (params.patch.isActive !== undefined) updatePayload.is_active = params.patch.isActive;

  const { data, error } = await supabase
    .from("clinic_knowledge_records")
    .update(updatePayload)
    .eq("id", params.recordId)
    .eq("clinic_id", params.clinicId)
    .eq("version", params.expectedVersion)
    .select()
    .maybeSingle();

  if (error) return { ok: false, reason: "forbidden" };

  if (!data) {
    const current = await getRecord(supabase, params.clinicId, params.recordId);
    if (!current) return { ok: false, reason: "not_found" };
    if (current.version !== params.expectedVersion) return { ok: false, reason: "conflict" };
    // The version we expected is still current, yet the write affected zero rows -- RLS must have silently blocked it.
    return { ok: false, reason: "forbidden" };
  }

  const record = parseKnowledgeRecordRow(data as KnowledgeRecordRow);
  await recordVersionSnapshot(supabase, record, { changedBy: params.actorId ?? null, changeReason: params.changeReason ?? null });
  return { ok: true, record };
}

/** Soft-deletes a record (is_active: false) via the same versioned CAS path as any other update -- retrieval (lib/ai/knowledge/query.ts) only ever reads active records, so this immediately and safely removes it from what the AI can surface without losing its history. */
export async function archiveKnowledgeRecord(
  supabase: SupabaseClient,
  params: { clinicId: string; recordId: string; expectedVersion: number; actorId?: string | null },
): Promise<StoreOutcome<KnowledgeRecord>> {
  return updateKnowledgeRecord(supabase, {
    clinicId: params.clinicId,
    recordId: params.recordId,
    expectedVersion: params.expectedVersion,
    patch: { isActive: false },
    actorId: params.actorId,
    changeReason: "archived",
  });
}

/** Lists a clinic's knowledge records for the admin-facing management view -- active only by default. */
export async function listKnowledgeRecords(
  supabase: SupabaseClient,
  params: { clinicId: string; category?: KnowledgeCategory | null; includeInactive?: boolean },
): Promise<KnowledgeRecord[]> {
  let query = supabase.from("clinic_knowledge_records").select("*").eq("clinic_id", params.clinicId);
  if (params.category) query = query.eq("category", params.category);
  if (!params.includeInactive) query = query.eq("is_active", true);

  const { data } = await query;
  return (data ?? []).map((row) => parseKnowledgeRecordRow(row as KnowledgeRecordRow));
}

/** Full version history for one record, newest first -- the admin-facing "what changed" view. */
export async function getKnowledgeRecordHistory(
  supabase: SupabaseClient,
  params: { clinicId: string; recordId: string },
): Promise<KnowledgeRecordVersion[]> {
  const { data } = await supabase
    .from("clinic_knowledge_record_versions")
    .select("*")
    .eq("clinic_id", params.clinicId)
    .eq("record_id", params.recordId)
    .order("version", { ascending: false });

  return (data ?? []).map((row) => parseKnowledgeRecordVersionRow(row as KnowledgeRecordVersionRow));
}
