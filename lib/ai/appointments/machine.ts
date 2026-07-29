import type { LifecycleEventType, LifecycleStatus, TransitionResult } from "@/lib/ai/appointments/types";

/**
 * The complete, deterministic transition table -- every (status, event)
 * pair not listed here is invalid. A "draft" only ever moves to a
 * terminal draft outcome (staff approves/rejects, or it expires
 * unactioned); a real appointment's lifecycle starts fresh at
 * "scheduled" once a draft is approved (see lib/ai/appointments/store.ts
 * -- that conversion itself is app/actions/appointment-drafts.ts's job,
 * unchanged by this engine).
 *
 * Both the granular path (check_in -> start -> complete) and the direct
 * path (scheduled/confirmed/checked_in -> complete, skipping
 * in_progress) are allowed -- real clinics vary in how much of this
 * granularity they actually use day to day, and neither is "more
 * correct". What's rejected is anything that would move an appointment
 * backwards or sideways out of a settled outcome (e.g. completed ->
 * scheduled, cancelled -> confirmed) or off of "archived", which is
 * fully terminal.
 */
const TRANSITIONS: Partial<Record<LifecycleStatus, Partial<Record<LifecycleEventType, LifecycleStatus>>>> = {
  draft: {
    approve: "draft_approved",
    reject: "draft_rejected",
    expire: "draft_expired",
  },
  draft_approved: {},
  draft_rejected: { archive: "archived" },
  draft_expired: { archive: "archived" },
  scheduled: {
    confirm: "confirmed",
    cancel: "cancelled",
    mark_no_show: "no_show",
    reschedule: "scheduled",
    send_reminder: "scheduled",
    check_in: "checked_in",
    complete: "completed",
  },
  confirmed: {
    cancel: "cancelled",
    mark_no_show: "no_show",
    reschedule: "confirmed",
    send_reminder: "confirmed",
    check_in: "checked_in",
    complete: "completed",
  },
  checked_in: {
    start: "in_progress",
    cancel: "cancelled",
    complete: "completed",
  },
  in_progress: {
    complete: "completed",
  },
  completed: { archive: "archived" },
  no_show: { archive: "archived" },
  cancelled: { archive: "archived" },
  archived: {},
};

/** The special "no status yet" starting point -- only a brand-new draft can begin here. */
const NEW_ENTITY_TRANSITIONS: Partial<Record<LifecycleEventType, LifecycleStatus>> = {
  create_draft: "draft",
};

/**
 * Pure state machine core: given the current status (null for a
 * not-yet-created entity) and an event, returns the next status or
 * rejects the transition as invalid. No I/O, no knowledge of Supabase --
 * lib/ai/appointments/store.ts is the only thing that actually persists
 * a transition this function approved.
 */
export function transition(currentStatus: LifecycleStatus | null, event: LifecycleEventType): TransitionResult {
  const table = currentStatus === null ? NEW_ENTITY_TRANSITIONS : (TRANSITIONS[currentStatus] ?? {});
  const toStatus = table[event];

  if (!toStatus) {
    return {
      ok: false,
      reason: "invalid_transition",
      message: `Cannot apply "${event}" from status "${currentStatus ?? "(none)"}".`,
    };
  }

  return { ok: true, toStatus };
}

/** True if no event can ever move this status anywhere else -- useful for callers deciding whether to even attempt a transition. */
export function isTerminalStatus(status: LifecycleStatus): boolean {
  const table = TRANSITIONS[status] ?? {};
  return Object.keys(table).length === 0;
}
