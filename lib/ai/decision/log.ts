import type { createAdminClient } from "@/lib/supabase/admin";
import type { AIDecision } from "@/lib/ai/decision/types";
import type { NLUExtraction } from "@/lib/ai/nlu/types";

/**
 * One row per Decision Engine verdict, mirroring recordNLUEvent (lib/ai/
 * nlu/log.ts) and recordTurnEvent (lib/ai/orchestrator.ts) -- same
 * grep-able structured log line convention, same best-effort guarantee:
 * a logging failure must never affect the patient-facing reply.
 */
export async function recordDecisionEvent(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    clinicId: string;
    conversationId: string;
    decision: AIDecision;
    nlu: NLUExtraction;
    latencyMs: number;
    model: string;
  },
) {
  const { decision, nlu } = params;

  console.log(
    `[ai:decision] clinic=${params.clinicId} conv=${params.conversationId} kind=${decision.kind} ` +
      `intent=${nlu.intent} urgency=${nlu.urgency} confidence=${nlu.confidence.toFixed(2)} reason="${decision.reason}"`,
  );

  await supabase
    .from("ai_decisions")
    .insert({
      clinic_id: params.clinicId,
      conversation_id: params.conversationId,
      decision_kind: decision.kind,
      reason: decision.reason,
      intent: nlu.intent,
      urgency: nlu.urgency,
      confidence: nlu.confidence,
      missing_fields: decision.kind === "ask_follow_up" ? decision.missingFields : [],
      latency_ms: params.latencyMs,
      model: params.model,
    })
    .then(({ error }) => {
      if (error) console.error("[ai:decision] failed to record decision event", error.message);
    });
}
