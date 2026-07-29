import { describe, expect, it } from "vitest";
import { mapLifecycleEventToActivityType } from "@/lib/ai/patient/mapping";
import { LIFECYCLE_EVENTS } from "@/lib/ai/appointments/types";

describe("mapLifecycleEventToActivityType", () => {
  it("maps every patient-facing lifecycle event to its activity type", () => {
    expect(mapLifecycleEventToActivityType("create_draft")).toBe("appointment_draft_created");
    expect(mapLifecycleEventToActivityType("approve")).toBe("appointment_approved");
    expect(mapLifecycleEventToActivityType("reject")).toBe("appointment_rejected");
    expect(mapLifecycleEventToActivityType("confirm")).toBe("appointment_confirmed");
    expect(mapLifecycleEventToActivityType("reschedule")).toBe("appointment_rescheduled");
    expect(mapLifecycleEventToActivityType("check_in")).toBe("appointment_checked_in");
    expect(mapLifecycleEventToActivityType("start")).toBe("appointment_started");
    expect(mapLifecycleEventToActivityType("complete")).toBe("appointment_completed");
    expect(mapLifecycleEventToActivityType("mark_no_show")).toBe("appointment_no_show");
    expect(mapLifecycleEventToActivityType("cancel")).toBe("appointment_cancelled");
    expect(mapLifecycleEventToActivityType("archive")).toBe("appointment_archived");
  });

  it("returns null for events with no patient-facing activity signal", () => {
    expect(mapLifecycleEventToActivityType("expire")).toBeNull();
    expect(mapLifecycleEventToActivityType("send_reminder")).toBeNull();
  });

  it("has a defined outcome (mapped or explicitly null) for every lifecycle event", () => {
    for (const event of LIFECYCLE_EVENTS) {
      // Just asserting the call doesn't throw and returns string|null.
      const result = mapLifecycleEventToActivityType(event);
      expect(result === null || typeof result === "string").toBe(true);
    }
  });
});
