import { describe, expect, it } from "vitest";
import { isTerminalStatus, transition } from "@/lib/ai/appointments/machine";
import type { LifecycleEventType, LifecycleStatus } from "@/lib/ai/appointments/types";

// Every single valid (currentStatus, event) -> nextStatus edge in the
// machine -- one row per real capability the engine supports (draft
// creation, staff approval/rejection/expiry, confirmation, rescheduling,
// cancellation, reminders, check-in, in-progress, completion, no-show,
// archival).
const VALID_TRANSITIONS: [LifecycleStatus | null, LifecycleEventType, LifecycleStatus][] = [
  [null, "create_draft", "draft"],
  ["draft", "approve", "draft_approved"],
  ["draft", "reject", "draft_rejected"],
  ["draft", "expire", "draft_expired"],
  ["draft_rejected", "archive", "archived"],
  ["draft_expired", "archive", "archived"],
  ["scheduled", "confirm", "confirmed"],
  ["scheduled", "cancel", "cancelled"],
  ["scheduled", "mark_no_show", "no_show"],
  ["scheduled", "reschedule", "scheduled"],
  ["scheduled", "send_reminder", "scheduled"],
  ["scheduled", "check_in", "checked_in"],
  ["scheduled", "complete", "completed"],
  ["confirmed", "cancel", "cancelled"],
  ["confirmed", "mark_no_show", "no_show"],
  ["confirmed", "reschedule", "confirmed"],
  ["confirmed", "send_reminder", "confirmed"],
  ["confirmed", "check_in", "checked_in"],
  ["confirmed", "complete", "completed"],
  ["checked_in", "start", "in_progress"],
  ["checked_in", "cancel", "cancelled"],
  ["checked_in", "complete", "completed"],
  ["in_progress", "complete", "completed"],
  ["completed", "archive", "archived"],
  ["no_show", "archive", "archived"],
  ["cancelled", "archive", "archived"],
];

describe("transition: every valid edge", () => {
  it.each(VALID_TRANSITIONS)("%s + %s -> %s", (from, event, expected) => {
    const result = transition(from, event);
    expect(result).toEqual({ ok: true, toStatus: expected });
  });

  it("covers every documented lifecycle event at least once", () => {
    const coveredEvents = new Set(VALID_TRANSITIONS.map(([, event]) => event));
    const allEvents: LifecycleEventType[] = [
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
    ];
    for (const event of allEvents) {
      expect(coveredEvents.has(event)).toBe(true);
    }
  });
});

describe("transition: invalid transitions are rejected", () => {
  const INVALID_CASES: [LifecycleStatus | null, LifecycleEventType][] = [
    // A settled outcome can't be un-settled.
    ["completed", "cancel"],
    ["completed", "confirm"],
    ["cancelled", "confirm"],
    ["cancelled", "complete"],
    ["no_show", "complete"],
    ["no_show", "cancel"],
    // Draft-only events don't apply to a real appointment, and vice versa.
    ["draft", "check_in"],
    ["draft", "complete"],
    ["draft", "confirm"],
    ["scheduled", "approve"],
    ["scheduled", "reject"],
    ["confirmed", "expire"],
    // draft_approved is terminal for the draft entity -- the real appointment's lifecycle starts over at "scheduled" separately.
    ["draft_approved", "confirm"],
    ["draft_approved", "archive"],
    // archived is fully terminal.
    ["archived", "archive"],
    ["archived", "cancel"],
    ["archived", "create_draft"],
    // Only a brand-new entity can be created; nothing else starts from "none".
    [null, "approve"],
    [null, "confirm"],
    [null, "cancel"],
    // Can't skip straight to in-progress without checking in first.
    ["scheduled", "start"],
    ["confirmed", "start"],
    // A rejected/expired draft can only be archived, not revived.
    ["draft_rejected", "approve"],
    ["draft_expired", "approve"],
  ];

  it.each(INVALID_CASES)("rejects %s + %s", (from, event) => {
    const result = transition(from, event);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_transition");
      expect(result.message).toContain(event);
    }
  });
});

describe("isTerminalStatus", () => {
  it("is true for fully terminal statuses", () => {
    expect(isTerminalStatus("archived")).toBe(true);
    expect(isTerminalStatus("draft_approved")).toBe(true);
  });

  it("is false for statuses that still have valid outgoing transitions", () => {
    expect(isTerminalStatus("draft")).toBe(false);
    expect(isTerminalStatus("scheduled")).toBe(false);
    expect(isTerminalStatus("confirmed")).toBe(false);
    expect(isTerminalStatus("checked_in")).toBe(false);
    expect(isTerminalStatus("in_progress")).toBe(false);
  });

  it("is false for outcomes that can still be archived", () => {
    expect(isTerminalStatus("completed")).toBe(false);
    expect(isTerminalStatus("no_show")).toBe(false);
    expect(isTerminalStatus("cancelled")).toBe(false);
    expect(isTerminalStatus("draft_rejected")).toBe(false);
    expect(isTerminalStatus("draft_expired")).toBe(false);
  });
});
