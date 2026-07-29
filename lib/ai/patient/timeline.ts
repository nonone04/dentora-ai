import type { PatientActivityEventType } from "@/lib/ai/patient/types";

const ACTIVITY_DESCRIPTIONS: Record<PatientActivityEventType, string> = {
  appointment_draft_created: "An appointment was proposed by the AI assistant",
  appointment_approved: "An appointment was approved by staff",
  appointment_rejected: "A proposed appointment was declined by staff",
  appointment_confirmed: "An appointment was confirmed",
  appointment_rescheduled: "An appointment was rescheduled",
  appointment_checked_in: "Checked in for an appointment",
  appointment_started: "Appointment started",
  appointment_completed: "Appointment completed",
  appointment_no_show: "Did not show up for an appointment",
  appointment_cancelled: "An appointment was cancelled",
  appointment_archived: "An appointment record was archived",
  conversation_started: "Started a conversation with the AI assistant",
  conversation_escalated: "A conversation was escalated to staff",
};

/** Human-readable, staff-facing description of one timeline entry -- used both for the AI Inbox-style display and as raw material for lib/ai/patient/rule-summary.ts. */
export function describeActivityEvent(type: PatientActivityEventType): string {
  return ACTIVITY_DESCRIPTIONS[type];
}
