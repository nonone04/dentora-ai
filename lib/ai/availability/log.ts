import type { AvailabilityResult } from "@/lib/ai/availability/types";
import type { createAdminClient } from "@/lib/supabase/admin";

/**
 * One row per proactive availability query, mirroring recordNLUEvent/
 * recordDecisionEvent -- same grep-able structured log line convention,
 * same best-effort guarantee: a logging failure must never affect the
 * patient-facing reply.
 */
export async function recordAvailabilityQuery(
  supabase: ReturnType<typeof createAdminClient>,
  params: {
    clinicId: string;
    conversationId: string;
    result: AvailabilityResult;
    latencyMs: number;
  },
) {
  const { result } = params;

  console.log(
    `[ai:availability] clinic=${params.clinicId} conv=${params.conversationId} date=${result.query.date} ` +
      `options=${result.options.length} fallbacks=${result.fallbacks.length} conflicts=${result.conflicts.length}`,
  );

  await supabase
    .from("ai_availability_queries")
    .insert({
      clinic_id: params.clinicId,
      conversation_id: params.conversationId,
      requested_date: result.query.date,
      service_id: result.query.serviceId ?? null,
      dentist_id: result.query.dentistId ?? null,
      options_count: result.options.length,
      conflicts: result.conflicts,
      fallback_count: result.fallbacks.length,
      fallback_date: result.fallbackDate,
      latency_ms: params.latencyMs,
    })
    .then(({ error }) => {
      if (error) console.error("[ai:availability] failed to record availability query", error.message);
    });
}
