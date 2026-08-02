import { describe, expect, it } from "vitest";
import { formatAppointmentDate, formatAppointmentTime, renderWhatsAppMessage } from "@/lib/whatsapp/templates";

const DATA = {
  patientName: "Sarah",
  clinicName: "Dentora Clinic",
  dentistName: "Dr. Ahmed",
  appointmentDate: "Monday, August 10",
  appointmentTime: "10:30 AM",
};

const MESSAGE_TYPES = ["reminder", "confirmation", "cancellation", "reschedule", "completed"] as const;

describe("renderWhatsAppMessage", () => {
  it("renders a non-empty, distinct body for every message type in every supported language", () => {
    for (const type of MESSAGE_TYPES) {
      const en = renderWhatsAppMessage(type, "en", DATA);
      const fr = renderWhatsAppMessage(type, "fr", DATA);
      const ar = renderWhatsAppMessage(type, "ar", DATA);

      expect(en.length).toBeGreaterThan(0);
      expect(fr.length).toBeGreaterThan(0);
      expect(ar.length).toBeGreaterThan(0);
      expect(en).not.toBe(fr);
      expect(en).not.toBe(ar);
    }
  });

  it("interpolates patient name, dentist, date, and time into the reminder", () => {
    const body = renderWhatsAppMessage("reminder", "en", DATA);
    expect(body).toContain("Sarah");
    expect(body).toContain("Dr. Ahmed");
    expect(body).toContain("Monday, August 10");
    expect(body).toContain("10:30 AM");
    expect(body).toContain("Dentora Clinic");
  });

  it("matches the requested tone: greeting, reminder framing, and a call to action", () => {
    const body = renderWhatsAppMessage("reminder", "en", DATA);
    expect(body).toMatch(/^Hello Sarah/);
    expect(body).toContain("reminder");
    expect(body).toMatch(/reply/i);
  });

  it("includes the cancellation reason when given", () => {
    const body = renderWhatsAppMessage("cancellation", "en", { ...DATA, reason: "Dentist unavailable" });
    expect(body).toContain("Dentist unavailable");
  });

  it("omits the reason line entirely when none is given", () => {
    const body = renderWhatsAppMessage("cancellation", "en", DATA);
    expect(body).not.toContain("Reason:");
  });

  it("includes the Google review link in the completed message when set", () => {
    const body = renderWhatsAppMessage("completed", "en", { ...DATA, reviewUrl: "https://g.page/r/example/review" });
    expect(body).toContain("https://g.page/r/example/review");
  });

  it("omits any review request when no review link is configured", () => {
    const body = renderWhatsAppMessage("completed", "en", DATA);
    expect(body).not.toContain("review");
    expect(body).toContain("Thank you for visiting");
  });

  it("degrades gracefully with a missing patient name (no literal 'null'/'undefined')", () => {
    const body = renderWhatsAppMessage("reminder", "en", { clinicName: "Dentora Clinic" });
    expect(body).not.toContain("null");
    expect(body).not.toContain("undefined");
  });
});

describe("formatAppointmentDate / formatAppointmentTime", () => {
  it("format the date and time portions separately for a given timezone/language", () => {
    const date = formatAppointmentDate("2026-08-10T09:00:00.000Z", "UTC", "en");
    const time = formatAppointmentTime("2026-08-10T09:00:00.000Z", "UTC", "en");
    expect(date).toMatch(/2026/);
    expect(date).not.toMatch(/\d{1,2}:\d{2}/);
    expect(time).toMatch(/\d{1,2}:\d{2}/);
    expect(time).not.toMatch(/2026/);
  });

  it("returns an empty string for an invalid input", () => {
    expect(formatAppointmentDate("not-a-date", "UTC", "en")).toBe("");
    expect(formatAppointmentTime("not-a-date", "UTC", "en")).toBe("");
  });
});
