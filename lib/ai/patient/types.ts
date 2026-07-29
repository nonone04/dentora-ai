import type { NotificationChannel } from "@/lib/notifications/provider";

export const PATIENT_ACTIVITY_EVENT_TYPES = [
  "appointment_draft_created",
  "appointment_approved",
  "appointment_rejected",
  "appointment_confirmed",
  "appointment_rescheduled",
  "appointment_checked_in",
  "appointment_started",
  "appointment_completed",
  "appointment_no_show",
  "appointment_cancelled",
  "appointment_archived",
  "conversation_started",
  "conversation_escalated",
] as const;

export type PatientActivityEventType = (typeof PATIENT_ACTIVITY_EVENT_TYPES)[number];

/** One entry to append to the immutable patient_activity_events timeline. */
export type PatientActivityEvent = {
  clinicId: string;
  patientId: string;
  type: PatientActivityEventType;
  appointmentId?: string | null;
  conversationId?: string | null;
  metadata?: Record<string, unknown>;
};

export const RELIABILITY_LABELS = ["excellent", "good", "fair", "poor", "insufficient_data"] as const;

export type ReliabilityLabel = (typeof RELIABILITY_LABELS)[number];

/** Deterministic, appointment-history-based reliability score -- see lib/ai/patient/reliability.ts. */
export type ReliabilityScore = {
  /** 0..1 -- see reliability.ts for the exact formula. */
  score: number;
  label: ReliabilityLabel;
  completedCount: number;
  noShowCount: number;
  cancelledCount: number;
  sampleSize: number;
};

export const TIME_OF_DAY_PREFERENCES = ["morning", "afternoon", "evening"] as const;

export type TimeOfDayPreference = (typeof TIME_OF_DAY_PREFERENCES)[number];

/** Learned from which channel the patient's conversations actually happened on -- see lib/ai/patient/preferences.ts. */
export type CommunicationPreferences = {
  preferredChannel: NotificationChannel | null;
  sampleSize: number;
};

/** Learned from the patient's completed appointment history -- see lib/ai/patient/preferences.ts. */
export type SchedulingPreferences = {
  preferredTimeOfDay: TimeOfDayPreference | null;
  preferredDentistId: string | null;
  sampleSize: number;
};

export const SUMMARY_SOURCES = ["rule_based", "llm"] as const;

export type SummarySource = (typeof SUMMARY_SOURCES)[number];

/** The materialized, versioned current view of one patient -- persisted in patient_profiles, recomputed by lib/ai/patient/store.ts's refreshPatientProfile. */
export type PatientProfile = {
  clinicId: string;
  patientId: string;
  reliability: ReliabilityScore;
  communication: CommunicationPreferences;
  scheduling: SchedulingPreferences;
  summary: string;
  summarySource: SummarySource;
  /** 0 for a profile that has never been persisted yet. */
  version: number;
  lastComputedAt: string;
};
