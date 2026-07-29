import { describe, expect, it } from "vitest";
import { formatAppointmentDateTime, renderNotificationTemplate, templateKeyFor } from "@/lib/notifications/templates";

const DATA = {
  clinicName: "Dentora Clinic",
  patientName: "Amina",
  dentistName: "Dr. Bennani",
  serviceName: "Cleaning",
  startAt: "2026-08-10T09:00:00.000Z",
  timezone: "UTC",
  reason: "Patient requested",
};

describe("formatAppointmentDateTime", () => {
  it("formats a date deterministically for a given timezone/language", () => {
    const formatted = formatAppointmentDateTime("2026-08-10T09:00:00.000Z", "UTC", "en");
    expect(formatted).toMatch(/2026/);
  });

  it("returns an empty string for a null/invalid input", () => {
    expect(formatAppointmentDateTime(null, "UTC", "en")).toBe("");
    expect(formatAppointmentDateTime("not-a-date", "UTC", "en")).toBe("");
  });
});

describe("renderNotificationTemplate: channel behavior", () => {
  it("includes a subject for email", () => {
    const rendered = renderNotificationTemplate("appointment_confirmed", "email", "en", DATA);
    expect(rendered.subject).toBeTruthy();
    expect(rendered.body).toContain("Amina");
  });

  it("omits the subject for whatsapp/sms/in_app -- the body stands alone", () => {
    for (const channel of ["whatsapp", "sms", "in_app"] as const) {
      const rendered = renderNotificationTemplate("appointment_confirmed", channel, "en", DATA);
      expect(rendered.subject).toBeNull();
      expect(rendered.body.length).toBeGreaterThan(0);
    }
  });
});

describe("renderNotificationTemplate: localization", () => {
  const EVENT_TYPES = [
    "appointment_booked",
    "appointment_confirmed",
    "appointment_cancelled",
    "appointment_rescheduled",
    "appointment_reminder",
    "conversation_escalated",
  ] as const;

  it("renders a non-empty, distinct body for every event type in every supported language", () => {
    for (const type of EVENT_TYPES) {
      const en = renderNotificationTemplate(type, "email", "en", DATA);
      const fr = renderNotificationTemplate(type, "email", "fr", DATA);
      const ar = renderNotificationTemplate(type, "email", "ar", DATA);

      expect(en.body.length).toBeGreaterThan(0);
      expect(fr.body.length).toBeGreaterThan(0);
      expect(ar.body.length).toBeGreaterThan(0);
      expect(en.body).not.toBe(fr.body);
      expect(en.body).not.toBe(ar.body);
    }
  });

  it("includes the cancellation reason in the body when given", () => {
    const rendered = renderNotificationTemplate("appointment_cancelled", "email", "en", DATA);
    expect(rendered.body).toContain("Patient requested");
  });

  it("includes the escalation reason in the staff-facing body", () => {
    const rendered = renderNotificationTemplate("conversation_escalated", "email", "en", { ...DATA, reason: "Upset patient" });
    expect(rendered.body).toContain("Upset patient");
  });
});

describe("templateKeyFor", () => {
  it("is a stable, human-readable identifier combining event type and channel", () => {
    expect(templateKeyFor("appointment_confirmed", "email")).toBe("appointment_confirmed:email");
    expect(templateKeyFor("conversation_escalated", "in_app")).toBe("conversation_escalated:in_app");
  });
});
