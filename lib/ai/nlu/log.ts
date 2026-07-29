import type { createAdminClient } from "@/lib/supabase/admin";
import type { NLUExtraction } from "@/lib/ai/nlu/types";

/**
 * One row per NLU extraction, mirroring recordTurnEvent in
 * lib/ai/orchestrator.ts -- same grep-able structured log line
 * convention, same best-effort guarantee: a logging failure must never
 * affect the patient-facing reply.
 */
export async function recordNLUEvent(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    clinicId: string;
    conversationId: string;
    extraction: NLUExtraction;
    latencyMs: number;
    model: string;
  },
) {
  const { extraction } = params;

  console.log(
    `[ai:nlu] clinic=${params.clinicId} conv=${params.conversationId} intent=${extraction.intent} ` +
      `urgency=${extraction.urgency} lang=${extraction.language} confidence=${extraction.confidence.toFixed(2)} ` +
      `missing=${extraction.missingFields.join(",") || "none"}`,
  );

  await supabase
    .from("ai_nlu_extractions")
    .insert({
      clinic_id: params.clinicId,
      conversation_id: params.conversationId,
      intent: extraction.intent,
      entities: extraction.entities,
      urgency: extraction.urgency,
      language: extraction.language,
      confidence: extraction.confidence,
      missing_fields: extraction.missingFields,
      latency_ms: params.latencyMs,
      model: params.model,
    })
    .then(({ error }) => {
      if (error) console.error("[ai:nlu] failed to record NLU event", error.message);
    });
}
