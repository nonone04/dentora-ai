import type { NotificationDeliveryStatus } from "@/lib/notifications/types";

export const DELIVERY_EVENTS = [
  "start_send",
  "send_succeeded",
  "retry",
  "exhaust",
  "skip",
  "mark_delivered",
  "mark_read",
] as const;

export type DeliveryEvent = (typeof DELIVERY_EVENTS)[number];

export type DeliveryTransitionResult =
  | { ok: true; toStatus: NotificationDeliveryStatus }
  | { ok: false; reason: "invalid_transition"; message: string };

/**
 * The complete, deterministic transition table for a single delivery's
 * status -- every (status, event) pair not listed here is invalid. Same
 * shape and rationale as lib/ai/appointments/machine.ts: no I/O, no
 * knowledge of Supabase or of *why* a retry vs. exhaust decision was
 * made (that's lib/notifications/retry.ts's shouldRetry, called by
 * lib/notifications/dispatch.ts before choosing which event to apply
 * here).
 *
 * "sent" is a valid terminal resting state on its own -- not every
 * channel/provider reports delivered/read receipts, so mark_delivered/
 * mark_read are optional next steps a webhook could apply later, not a
 * requirement for a delivery to be considered done.
 */
const TRANSITIONS: Partial<Record<NotificationDeliveryStatus, Partial<Record<DeliveryEvent, NotificationDeliveryStatus>>>> = {
  pending: {
    start_send: "sending",
    skip: "failed",
  },
  sending: {
    send_succeeded: "sent",
    retry: "pending",
    exhaust: "failed",
  },
  sent: {
    mark_delivered: "delivered",
    mark_read: "read",
  },
  delivered: {
    mark_read: "read",
  },
  read: {},
  failed: {},
};

export function transitionDelivery(currentStatus: NotificationDeliveryStatus, event: DeliveryEvent): DeliveryTransitionResult {
  const toStatus = (TRANSITIONS[currentStatus] ?? {})[event];

  if (!toStatus) {
    return {
      ok: false,
      reason: "invalid_transition",
      message: `Cannot apply "${event}" from status "${currentStatus}".`,
    };
  }

  return { ok: true, toStatus };
}

export function isTerminalDeliveryStatus(status: NotificationDeliveryStatus): boolean {
  return Object.keys(TRANSITIONS[status] ?? {}).length === 0;
}
