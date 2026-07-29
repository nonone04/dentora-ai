export { recordLifecycleEvent } from "@/lib/ai/appointments/audit";
export { deriveAppointmentStatus, deriveDraftStatus } from "@/lib/ai/appointments/derive";
export type { CoarseAppointmentStatus, CoarseDraftStatus } from "@/lib/ai/appointments/derive";
export { findUpcomingAppointmentForPatient } from "@/lib/ai/appointments/lookup";
export type { UpcomingAppointment } from "@/lib/ai/appointments/lookup";
export { isTerminalStatus, transition } from "@/lib/ai/appointments/machine";
export { recordDraftCreated, transitionAppointment, transitionDraft } from "@/lib/ai/appointments/store";
export type { TransitionOutcome } from "@/lib/ai/appointments/store";
export {
  APPOINTMENT_STATUSES,
  DRAFT_STATUSES,
  LIFECYCLE_ACTORS,
  LIFECYCLE_EVENTS,
  LIFECYCLE_STATUSES,
} from "@/lib/ai/appointments/types";
export type {
  LifecycleActor,
  LifecycleEntityType,
  LifecycleEvent,
  LifecycleEventType,
  LifecycleStatus,
  TransitionResult,
} from "@/lib/ai/appointments/types";
