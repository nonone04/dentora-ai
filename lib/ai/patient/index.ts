export { recordPatientActivity } from "@/lib/ai/patient/activity";
export { generateLLMSummary } from "@/lib/ai/patient/llm-summary";
export { mapLifecycleEventToActivityType } from "@/lib/ai/patient/mapping";
export { learnCommunicationPreferences, learnSchedulingPreferences } from "@/lib/ai/patient/preferences";
export { computeReliabilityScore } from "@/lib/ai/patient/reliability";
export type { AppointmentOutcome } from "@/lib/ai/patient/reliability";
export { buildRuleBasedSummary } from "@/lib/ai/patient/rule-summary";
export type { SummaryInputs } from "@/lib/ai/patient/rule-summary";
export { generatePatientSummary } from "@/lib/ai/patient/summary";
export { loadPatientProfile, refreshPatientProfile } from "@/lib/ai/patient/store";
export { describeActivityEvent } from "@/lib/ai/patient/timeline";
export {
  PATIENT_ACTIVITY_EVENT_TYPES,
  RELIABILITY_LABELS,
  SUMMARY_SOURCES,
  TIME_OF_DAY_PREFERENCES,
} from "@/lib/ai/patient/types";
export type {
  CommunicationPreferences,
  PatientActivityEvent,
  PatientActivityEventType,
  PatientProfile,
  ReliabilityLabel,
  ReliabilityScore,
  SchedulingPreferences,
  SummarySource,
  TimeOfDayPreference,
} from "@/lib/ai/patient/types";
export { parsePatientProfileRow, patientProfileToRow } from "@/lib/ai/patient/validate";
export type { PatientProfileRow } from "@/lib/ai/patient/validate";
