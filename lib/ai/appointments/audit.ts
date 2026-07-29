import type { SupabaseClient } from "@supabase/supabase-js";
import type { LifecycleEvent } from "@/lib/ai/appointments/types";

/**
 * Records one row of the immutable appointment lifecycle audit trail.
 * Takes a generic SupabaseClient (not specifically the admin client, see
 * lib/audit/log.ts's logAuditEvent for the same convention) because this
 * is called both from the AI orchestrator's admin client (draft
 * creation, AI-initiated cancel/reschedule) and from real staff sessions
 * (app/actions/appointment-drafts.ts's approveDraft/rejectDraft) --
 * either way it works identically. Best-effort: a logging failure must
 * never affect the caller's own success/failure.
 */
export async function recordLifecycleEvent(supabase: SupabaseClient, event: LifecycleEvent) {
  const entityId = event.appointmentId ?? event.appointmentDraftId ?? "(unknown)";

  console.log(
    `[ai:appointments] clinic=${event.clinicId} entity=${event.entityType}:${entityId} event=${event.event} ` +
      `${event.fromStatus ?? "(none)"} -> ${event.toStatus} actor=${event.actor}`,
  );

  const { error } = await supabase.from("appointment_lifecycle_events").insert({
    clinic_id: event.clinicId,
    entity_type: event.entityType,
    appointment_id: event.appointmentId ?? null,
    appointment_draft_id: event.appointmentDraftId ?? null,
    event: event.event,
    from_status: event.fromStatus,
    to_status: event.toStatus,
    actor: event.actor,
    actor_id: event.actorId ?? null,
    conversation_id: event.conversationId ?? null,
    reason: event.reason ?? null,
    metadata: event.metadata ?? {},
  });

  if (error) console.error("[ai:appointments] failed to record lifecycle event", error.message);
}
