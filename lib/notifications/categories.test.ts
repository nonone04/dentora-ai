import { describe, expect, it } from "vitest";
import { categoryForEventType, EVENT_TYPE_TO_CATEGORY, NOTIFICATION_CATEGORIES } from "@/lib/notifications/categories";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/types";

describe("EVENT_TYPE_TO_CATEGORY", () => {
  it("maps every existing NotificationEventType to a category", () => {
    for (const type of NOTIFICATION_EVENT_TYPES) {
      expect(NOTIFICATION_CATEGORIES).toContain(EVENT_TYPE_TO_CATEGORY[type]);
    }
  });

  it("maps every appointment event type to the appointments category", () => {
    for (const type of ["appointment_booked", "appointment_confirmed", "appointment_cancelled", "appointment_rescheduled", "appointment_reminder"] as const) {
      expect(EVENT_TYPE_TO_CATEGORY[type]).toBe("appointments");
    }
  });

  it("maps conversation_escalated to the ai category", () => {
    expect(EVENT_TYPE_TO_CATEGORY.conversation_escalated).toBe("ai");
  });
});

describe("categoryForEventType", () => {
  it("returns null for a missing event type", () => {
    expect(categoryForEventType(null)).toBeNull();
    expect(categoryForEventType(undefined)).toBeNull();
  });

  it("resolves a known event type", () => {
    expect(categoryForEventType("appointment_reminder")).toBe("appointments");
  });
});
