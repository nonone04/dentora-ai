import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeCategory, KnowledgeRecord } from "@/lib/ai/knowledge/types";
import { parseKnowledgeRecordRow, type KnowledgeRecordRow } from "@/lib/ai/knowledge/validate";

/**
 * Fetches every active knowledge record for a clinic (optionally
 * pre-filtered to one category) -- the raw material lib/ai/knowledge/
 * match.ts's searchKnowledge ranks. Never throws: a query failure
 * resolves to an empty list, which searchKnowledge already treats as a
 * clean miss.
 */
export async function fetchActiveKnowledgeRecords(
  supabase: SupabaseClient,
  params: { clinicId: string; category?: KnowledgeCategory | null },
): Promise<KnowledgeRecord[]> {
  try {
    let query = supabase.from("clinic_knowledge_records").select("*").eq("clinic_id", params.clinicId).eq("is_active", true);
    if (params.category) query = query.eq("category", params.category);

    const { data, error } = await query;
    if (error || !data) return [];

    return (data as KnowledgeRecordRow[]).map(parseKnowledgeRecordRow);
  } catch (err) {
    console.error("[ai:knowledge] failed to fetch knowledge records", err instanceof Error ? err.message : err);
    return [];
  }
}
