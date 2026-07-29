/**
 * Which underlying row this lifecycle applies to -- an appointment_drafts
 * row (the AI's proposal, awaiting staff review) or a real appointments
 * row (created once staff approves a draft, or created directly by
 * staff). The two have separate status vocabularies below because
 * that's what the schema already enforces (appointment_draft_status vs
 * appointment_status) -- this engine doesn't change either enum.
 */
export type LifecycleEntityType = "draft" | "appointment";

export const DRAFT_STATUSES = ["draft", "draft_approved", "draft_rejected", "draft_expired"] as const;

/**
 * The five real appointments.status values, plus three finer-grained
 * states (checked_in, in_progress, archived) that have no matching DB
 * column -- they're derived from the coarse status plus the latest
 * lifecycle event instead (see lib/ai/appointments/derive.ts), so this
 * type stays purely additive to the schema.
 */
export const APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
  "checked_in",
  "in_progress",
  "completed",
  "no_show",
  "cancelled",
] as const;

export const LIFECYCLE_STATUSES = [...DRAFT_STATUSES, ...APPOINTMENT_STATUSES, "archived"] as const;

export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const LIFECYCLE_EVENTS = [
  "create_draft",
  "approve",
  "reject",
  "expire",
  "confirm",
  "check_in",
  "start",
  "complete",
  "mark_no_show",
  "cancel",
  "reschedule",
  "send_reminder",
  "archive",
] as const;

export type LifecycleEventType = (typeof LIFECYCLE_EVENTS)[number];

export const LIFECYCLE_ACTORS = ["ai_assistant", "staff", "system"] as const;

export type LifecycleActor = (typeof LIFECYCLE_ACTORS)[number];

export type TransitionResult =
  | { ok: true; toStatus: LifecycleStatus }
  | { ok: false; reason: "invalid_transition"; message: string };

/** One row of the immutable audit trail (appointment_lifecycle_events). */
export type LifecycleEvent = {
  clinicId: string;
  entityType: LifecycleEntityType;
  appointmentId?: string | null;
  appointmentDraftId?: string | null;
  event: LifecycleEventType;
  fromStatus: LifecycleStatus | null;
  toStatus: LifecycleStatus;
  actor: LifecycleActor;
  actorId?: string | null;
  conversationId?: string | null;
  reason?: string | null;
  metadata?: Record<string, unknown>;
};
