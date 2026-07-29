import type { NotificationChannel } from "@/lib/notifications/provider";
import {
  RELIABILITY_LABELS,
  SUMMARY_SOURCES,
  TIME_OF_DAY_PREFERENCES,
  type PatientProfile,
  type ReliabilityLabel,
  type SummarySource,
  type TimeOfDayPreference,
} from "@/lib/ai/patient/types";

const NOTIFICATION_CHANNELS = ["email", "sms", "whatsapp"] as const;

function isReliabilityLabel(value: unknown): value is ReliabilityLabel {
  return typeof value === "string" && (RELIABILITY_LABELS as readonly string[]).includes(value);
}

function isSummarySource(value: unknown): value is SummarySource {
  return typeof value === "string" && (SUMMARY_SOURCES as readonly string[]).includes(value);
}

function isTimeOfDay(value: unknown): value is TimeOfDayPreference {
  return typeof value === "string" && (TIME_OF_DAY_PREFERENCES as readonly string[]).includes(value);
}

function isNotificationChannel(value: unknown): value is NotificationChannel {
  return typeof value === "string" && (NOTIFICATION_CHANNELS as readonly string[]).includes(value);
}

function clampScore(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.min(1, Math.max(0, num));
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

/** Shape of a patient_profiles row as returned by supabase-js. */
export type PatientProfileRow = {
  clinic_id: unknown;
  patient_id: unknown;
  reliability_score: unknown;
  reliability_label: unknown;
  completed_count: unknown;
  no_show_count: unknown;
  cancelled_count: unknown;
  preferred_channel: unknown;
  channel_sample_size: unknown;
  preferred_time_of_day: unknown;
  preferred_dentist_id: unknown;
  summary: unknown;
  summary_source: unknown;
  version: unknown;
  last_computed_at: unknown;
};

/**
 * Validates + coerces an untrusted DB row into a typed PatientProfile --
 * same defensive posture as every other *.validate.ts in lib/ai: a
 * malformed or partially-corrupt row degrades to safe per-field
 * defaults rather than throwing.
 */
export function parsePatientProfileRow(row: PatientProfileRow): PatientProfile {
  const completedCount = toCount(row.completed_count);
  const noShowCount = toCount(row.no_show_count);
  const cancelledCount = toCount(row.cancelled_count);

  return {
    clinicId: typeof row.clinic_id === "string" ? row.clinic_id : "",
    patientId: typeof row.patient_id === "string" ? row.patient_id : "",
    reliability: {
      score: clampScore(row.reliability_score),
      label: isReliabilityLabel(row.reliability_label) ? row.reliability_label : "insufficient_data",
      completedCount,
      noShowCount,
      cancelledCount,
      sampleSize: completedCount + noShowCount + cancelledCount,
    },
    communication: {
      preferredChannel: isNotificationChannel(row.preferred_channel) ? row.preferred_channel : null,
      sampleSize: toCount(row.channel_sample_size),
    },
    scheduling: {
      preferredTimeOfDay: isTimeOfDay(row.preferred_time_of_day) ? row.preferred_time_of_day : null,
      preferredDentistId: typeof row.preferred_dentist_id === "string" ? row.preferred_dentist_id : null,
      // Scheduling preferences are learned only from completed appointments (see preferences.ts), so that sample size is exactly the completed count -- no separate column needed.
      sampleSize: completedCount,
    },
    summary: typeof row.summary === "string" ? row.summary : "",
    summarySource: isSummarySource(row.summary_source) ? row.summary_source : "rule_based",
    version: typeof row.version === "number" ? row.version : 0,
    lastComputedAt: typeof row.last_computed_at === "string" ? row.last_computed_at : new Date(0).toISOString(),
  };
}

/** The inverse mapping, for writes -- version is passed separately since the caller (store.ts) decides insert-initial vs. CAS-increment. */
export function patientProfileToRow(profile: PatientProfile, version: number): Record<string, unknown> {
  return {
    clinic_id: profile.clinicId,
    patient_id: profile.patientId,
    reliability_score: profile.reliability.score,
    reliability_label: profile.reliability.label,
    completed_count: profile.reliability.completedCount,
    no_show_count: profile.reliability.noShowCount,
    cancelled_count: profile.reliability.cancelledCount,
    preferred_channel: profile.communication.preferredChannel,
    channel_sample_size: profile.communication.sampleSize,
    preferred_time_of_day: profile.scheduling.preferredTimeOfDay,
    preferred_dentist_id: profile.scheduling.preferredDentistId,
    summary: profile.summary,
    summary_source: profile.summarySource,
    version,
    last_computed_at: new Date().toISOString(),
  };
}
