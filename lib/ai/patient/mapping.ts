import type { LifecycleEventType } from "@/lib/ai/appointments/types";
import type { PatientActivityEventType } from "@/lib/ai/patient/types";

/**
 * How the Appointment Lifecycle Engine's events (lib/ai/appointments)
 * translate into patient-facing timeline entries. Deliberately partial:
 * "expire" (a draft going stale unactioned) isn't something the patient
 * did, and "send_reminder" is already tracked in the notifications
 * table -- neither is a meaningful patient activity signal.
 */
const LIFECYCLE_EVENT_TO_ACTIVITY_TYPE: Partial<Record<LifecycleEventType, PatientActivityEventType>> = {
  create_draft: "appointment_draft_created",
  approve: "appointment_approved",
  reject: "appointment_rejected",
  confirm: "appointment_confirmed",
  reschedule: "appointment_rescheduled",
  check_in: "appointment_checked_in",
  start: "appointment_started",
  complete: "appointment_completed",
  mark_no_show: "appointment_no_show",
  cancel: "appointment_cancelled",
  archive: "appointment_archived",
};

/** Returns null for lifecycle events with no matching patient activity type -- callers should skip logging in that case rather than log something misleading. */
export function mapLifecycleEventToActivityType(event: LifecycleEventType): PatientActivityEventType | null {
  return LIFECYCLE_EVENT_TO_ACTIVITY_TYPE[event] ?? null;
}
