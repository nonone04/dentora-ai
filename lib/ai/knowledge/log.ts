import type { SupabaseClient } from "@supabase/supabase-js";
import type { KnowledgeSearchResult } from "@/lib/ai/knowledge/types";

/**
 * Records one row per retrieval attempt into clinic_knowledge_searches
 * -- hits and misses alike, which is the whole point: a clinic can see
 * exactly what patients asked that the knowledge base didn't cover.
 * Best-effort, same convention as every other *.log.ts in lib/ai: a
 * logging failure must never affect the patient-facing reply.
 */
export async function recordKnowledgeSearch(
  supabase: SupabaseClient,
  params: {
    clinicId: string;
    conversationId?: string | null;
    result: KnowledgeSearchResult;
    latencyMs: number;
  },
) {
  const { result } = params;
  const topScore = result.matches[0]?.score ?? null;

  console.log(
    `[ai:knowledge] clinic=${params.clinicId} conv=${params.conversationId ?? "(none)"} query="${result.query}" ` +
      `category=${result.category ?? "(any)"} hit=${result.hit} matches=${result.matches.length}`,
  );

  const { error } = await supabase.from("clinic_knowledge_searches").insert({
    clinic_id: params.clinicId,
    conversation_id: params.conversationId ?? null,
    query: result.query,
    category: result.category,
    hit: result.hit,
    matched_record_ids: result.matches.map((match) => match.record.id),
    top_score: topScore,
    latency_ms: params.latencyMs,
  });

  if (error) console.error("[ai:knowledge] failed to record knowledge search", error.message);
}
