import { describe, expect, it } from "vitest";
import { renderNotificationEmailHtml } from "@/lib/notifications/email-html";
import type { NotificationEventType } from "@/lib/notifications/types";

const DATA = {
  clinicName: "Dentora Clinic",
  clinicEmail: "hello@dentora-clinic.example",
  patientName: "Amina",
  dentistName: "Dr. Bennani",
  serviceName: "Cleaning",
  startAt: "2026-08-10T09:00:00.000Z",
  timezone: "UTC",
  reason: "Patient requested",
};

const WIRED_EVENT_TYPES: NotificationEventType[] = [
  "appointment_confirmed",
  "appointment_reminder",
  "appointment_cancelled",
  "appointment_rescheduled",
];

const UNWIRED_EVENT_TYPES: NotificationEventType[] = ["appointment_booked", "conversation_escalated"];

describe("renderNotificationEmailHtml", () => {
  it.each(WIRED_EVENT_TYPES)("returns branded HTML for %s on the email channel", (eventType) => {
    const html = renderNotificationEmailHtml(eventType, "email", "en", DATA);
    expect(html).not.toBeNull();
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Amina");
  });

  it.each(UNWIRED_EVENT_TYPES)("returns null for %s -- unchanged plain-text-only behavior", (eventType) => {
    expect(renderNotificationEmailHtml(eventType, "email", "en", DATA)).toBeNull();
  });

  it.each(WIRED_EVENT_TYPES)("returns null for %s on non-email channels", (eventType) => {
    expect(renderNotificationEmailHtml(eventType, "in_app", "en", DATA)).toBeNull();
    expect(renderNotificationEmailHtml(eventType, "whatsapp", "en", DATA)).toBeNull();
    expect(renderNotificationEmailHtml(eventType, "sms", "en", DATA)).toBeNull();
  });
});
