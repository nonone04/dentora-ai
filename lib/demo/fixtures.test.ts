import { describe, expect, it } from "vitest";
import { buildDemoAppointments, DEMO_DENTISTS, DEMO_PATIENTS, DEMO_SERVICES } from "@/lib/demo/fixtures";

describe("buildDemoAppointments", () => {
  const now = new Date("2026-07-28T09:00:00.000Z");
  const appointments = buildDemoAppointments(now);

  it("produces a non-empty schedule", () => {
    expect(appointments.length).toBeGreaterThan(0);
  });

  it("never overlaps two appointments for the same dentist (required by the DB exclusion constraint)", () => {
    const byDentist = new Map<number, { start: number; end: number }[]>();
    for (const a of appointments) {
      const list = byDentist.get(a.dentistIndex) ?? [];
      list.push({ start: new Date(a.startAt).getTime(), end: new Date(a.endAt).getTime() });
      byDentist.set(a.dentistIndex, list);
    }

    for (const slots of byDentist.values()) {
      slots.sort((a, b) => a.start - b.start);
      for (let i = 1; i < slots.length; i++) {
        expect(slots[i].start).toBeGreaterThanOrEqual(slots[i - 1].end);
      }
    }
  });

  it("always has end_at after start_at", () => {
    for (const a of appointments) {
      expect(new Date(a.endAt).getTime()).toBeGreaterThan(new Date(a.startAt).getTime());
    }
  });

  it("only schedules on weekdays", () => {
    for (const a of appointments) {
      const day = new Date(a.startAt).getUTCDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it("only references valid fixture indices", () => {
    for (const a of appointments) {
      expect(a.dentistIndex).toBeLessThan(DEMO_DENTISTS.length);
      expect(a.serviceIndex).toBeLessThan(DEMO_SERVICES.length);
      expect(a.patientIndex).toBeLessThan(DEMO_PATIENTS.length);
    }
  });

  it("is deterministic for the same `now`", () => {
    expect(buildDemoAppointments(now)).toEqual(appointments);
  });
});
