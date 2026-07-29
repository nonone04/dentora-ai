import type { LifecycleStatus } from "@/lib/ai/appointments/types";

export type CoarseAppointmentStatus = "scheduled" | "confirmed" | "completed" | "no_show" | "cancelled";
export type CoarseDraftStatus = "proposed" | "confirmed" | "rejected" | "expired";

const ACTIVE_COARSE_STATUSES = new Set<CoarseAppointmentStatus>(["scheduled", "confirmed"]);
const FINE_ONLY_STATUSES = new Set<LifecycleStatus>(["checked_in", "in_progress"]);

/**
 * checked_in/in_progress/archived have no matching appointments.status
 * value (that enum only has scheduled/confirmed/cancelled/completed/
 * no_show) -- this derives the engine's actual current fine-grained
 * status from that coarse DB column plus the single most recent
 * lifecycle event for this appointment. Pure -- lib/ai/appointments/
 * store.ts is the only caller that fetches the two inputs this needs.
 *
 * Correct because: once the coarse status leaves "scheduled"/
 * "confirmed" (i.e. a real completion/cancellation/no-show happened),
 * that write itself only ever comes from a validated transition (see
 * machine.ts) -- so a prior check_in/start event is necessarily stale
 * the moment coarse status changes, and doesn't need to be considered.
 * While still active, the latest event (if it's check_in/start) is
 * always still current, because reaching complete/cancel/no_show would
 * have already changed the coarse status away from active.
 */
export function deriveAppointmentStatus(
  coarseStatus: CoarseAppointmentStatus,
  latestEventToStatus: LifecycleStatus | null,
): LifecycleStatus {
  if (ACTIVE_COARSE_STATUSES.has(coarseStatus)) {
    if (latestEventToStatus && FINE_ONLY_STATUSES.has(latestEventToStatus)) {
      return latestEventToStatus;
    }
    return coarseStatus;
  }

  // Terminal coarse status (completed/no_show/cancelled) -- the only finer state possible from here is "archived".
  if (latestEventToStatus === "archived") return "archived";
  return coarseStatus;
}

const DRAFT_STATUS_MAP: Record<CoarseDraftStatus, LifecycleStatus> = {
  proposed: "draft",
  confirmed: "draft_approved",
  rejected: "draft_rejected",
  expired: "draft_expired",
};

/** Same reasoning as deriveAppointmentStatus, for appointment_drafts.status -- the only finer state a rejected/expired draft can reach is "archived". */
export function deriveDraftStatus(coarseStatus: CoarseDraftStatus, latestEventToStatus: LifecycleStatus | null): LifecycleStatus {
  const base = DRAFT_STATUS_MAP[coarseStatus];
  if ((coarseStatus === "rejected" || coarseStatus === "expired") && latestEventToStatus === "archived") {
    return "archived";
  }
  return base;
}
