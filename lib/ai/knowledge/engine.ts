import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchActiveKnowledgeRecords } from "@/lib/ai/knowledge/query";
import { recordKnowledgeSearch } from "@/lib/ai/knowledge/log";
import { searchKnowledge } from "@/lib/ai/knowledge/match";
import type { KnowledgeCategory, KnowledgeSearchResult } from "@/lib/ai/knowledge/types";

/**
 * The engine's top-level, orchestrator-facing entry point: fetches this
 * clinic's active knowledge, ranks it deterministically against the
 * query (lib/ai/knowledge/match.ts), and logs the attempt -- hit or
 * miss -- for analytics (lib/ai/knowledge/log.ts). Never throws: a
 * failure fetching/ranking degrades to a clean miss, and -- separately
 * -- a failure logging the analytics row can never discard an
 * already-computed result. The two are deliberately isolated in their
 * own try/catch blocks so a best-effort logging problem can't turn a
 * real hit into a reported miss.
 */
export async function retrieveClinicKnowledge(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    query: string;
    category?: KnowledgeCategory | null;
    conversationId?: string | null;
    limit?: number;
  },
): Promise<KnowledgeSearchResult> {
  const startedAt = Date.now();

  let result: KnowledgeSearchResult;
  try {
    const records = await fetchActiveKnowledgeRecords(supabase, { clinicId: params.clinicId, category: params.category });
    result = searchKnowledge(records, params.query, { category: params.category, limit: params.limit });
  } catch (err) {
    console.error("[ai:knowledge] retrieval failed", err instanceof Error ? err.message : err);
    return { query: params.query, category: params.category ?? null, matches: [], hit: false };
  }

  try {
    await recordKnowledgeSearch(supabase, {
      clinicId: params.clinicId,
      conversationId: params.conversationId,
      result,
      latencyMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error("[ai:knowledge] failed to record knowledge search analytics", err instanceof Error ? err.message : err);
  }

  return result;
}
