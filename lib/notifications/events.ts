import type { SupabaseClient } from "@supabase/supabase-js";
import type { NotificationEvent, NotificationEventType } from "@/lib/notifications/types";

export type RecordNotificationEventParams = {
  clinicId: string;
  type: NotificationEventType;
  appointmentId?: string | null;
  appointmentDraftId?: string | null;
  patientId?: string | null;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Records one row of the immutable notification_events log. Same
 * best-effort-on-the-logging-side posture as lib/ai/appointments/
 * audit.ts's recordLifecycleEvent -- a logging failure is reported but
 * never thrown, since a missing analytics row must never be allowed to
 * take down the caller (a lifecycle transition that already succeeded,
 * a draft that was already created).
 */
export async function recordNotificationEvent(
  supabase: SupabaseClient,
  params: RecordNotificationEventParams,
): Promise<NotificationEvent | null> {
  const { data, error } = await supabase
    .from("notification_events")
    .insert({
      clinic_id: params.clinicId,
      type: params.type,
      appointment_id: params.appointmentId ?? null,
      appointment_draft_id: params.appointmentDraftId ?? null,
      patient_id: params.patientId ?? null,
      conversation_id: params.conversationId ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .maybeSingle();

  if (error || !data) {
    console.error("[notifications] failed to record notification event", error?.message);
    return null;
  }

  return {
    id: data.id as string,
    clinicId: data.clinic_id as string,
    type: data.type as NotificationEventType,
    appointmentId: (data.appointment_id as string | null) ?? null,
    appointmentDraftId: (data.appointment_draft_id as string | null) ?? null,
    patientId: (data.patient_id as string | null) ?? null,
    conversationId: (data.conversation_id as string | null) ?? null,
    metadata: (data.metadata as Record<string, unknown>) ?? {},
    createdAt: data.created_at as string,
  };
}
