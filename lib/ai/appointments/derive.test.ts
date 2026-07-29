import { describe, expect, it } from "vitest";
import { deriveAppointmentStatus, deriveDraftStatus } from "@/lib/ai/appointments/derive";

describe("deriveAppointmentStatus", () => {
  it("returns the coarse status directly when there is no lifecycle event yet", () => {
    expect(deriveAppointmentStatus("scheduled", null)).toBe("scheduled");
    expect(deriveAppointmentStatus("confirmed", null)).toBe("confirmed");
  });

  it("surfaces checked_in while the coarse status is still active", () => {
    expect(deriveAppointmentStatus("scheduled", "checked_in")).toBe("checked_in");
    expect(deriveAppointmentStatus("confirmed", "checked_in")).toBe("checked_in");
  });

  it("surfaces in_progress while the coarse status is still active", () => {
    expect(deriveAppointmentStatus("scheduled", "in_progress")).toBe("in_progress");
    expect(deriveAppointmentStatus("confirmed", "in_progress")).toBe("in_progress");
  });

  it("ignores an unrelated latest event while active (e.g. a reminder was sent, not a check-in)", () => {
    expect(deriveAppointmentStatus("confirmed", "confirmed")).toBe("confirmed");
  });

  it("a terminal coarse status always wins over a stale checked_in/in_progress event", () => {
    // If the coarse status is "completed", a check_in event must have happened before that -- it's history now.
    expect(deriveAppointmentStatus("completed", "checked_in")).toBe("completed");
    expect(deriveAppointmentStatus("completed", "in_progress")).toBe("completed");
    expect(deriveAppointmentStatus("no_show", "checked_in")).toBe("no_show");
    expect(deriveAppointmentStatus("cancelled", "checked_in")).toBe("cancelled");
  });

  it("surfaces archived once the terminal status has an archive event on top", () => {
    expect(deriveAppointmentStatus("completed", "archived")).toBe("archived");
    expect(deriveAppointmentStatus("no_show", "archived")).toBe("archived");
    expect(deriveAppointmentStatus("cancelled", "archived")).toBe("archived");
  });

  it("returns the terminal coarse status as-is when there's no archive event", () => {
    expect(deriveAppointmentStatus("completed", null)).toBe("completed");
    expect(deriveAppointmentStatus("no_show", null)).toBe("no_show");
    expect(deriveAppointmentStatus("cancelled", null)).toBe("cancelled");
  });
});

describe("deriveDraftStatus", () => {
  it("maps each coarse draft status to its engine equivalent", () => {
    expect(deriveDraftStatus("proposed", null)).toBe("draft");
    expect(deriveDraftStatus("confirmed", null)).toBe("draft_approved");
    expect(deriveDraftStatus("rejected", null)).toBe("draft_rejected");
    expect(deriveDraftStatus("expired", null)).toBe("draft_expired");
  });

  it("surfaces archived for a rejected draft with an archive event on top", () => {
    expect(deriveDraftStatus("rejected", "archived")).toBe("archived");
  });

  it("surfaces archived for an expired draft with an archive event on top", () => {
    expect(deriveDraftStatus("expired", "archived")).toBe("archived");
  });

  it("an approved draft ignores an archive-shaped event (only rejected/expired drafts can be archived)", () => {
    expect(deriveDraftStatus("confirmed", "archived")).toBe("draft_approved");
  });
});
