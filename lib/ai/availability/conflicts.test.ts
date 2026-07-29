import { describe, expect, it } from "vitest";
import { detectConflicts } from "@/lib/ai/availability/conflicts";
import type { DentistAvailability } from "@/lib/ai/availability/types";

const DENTIST_A = { id: "dentist-a", fullName: "Dr. Amrani" };
const DENTIST_B = { id: "dentist-b", fullName: "Dr. Bennis" };

function withSlots(dentistId: string, count: number): DentistAvailability {
  return {
    dentistId,
    dentistName: dentistId,
    slots: Array.from({ length: count }, (_, i) => ({ startAt: `2026-08-05T0${9 + i}:00:00.000Z`, endAt: `2026-08-05T0${9 + i}:30:00.000Z` })),
  };
}

describe("detectConflicts", () => {
  it("flags no_active_dentists when the clinic has none active", () => {
    const conflicts = detectConflicts({
      activeDentists: [],
      dentistAvailability: [],
      workingHoursByDentist: {},
      timeOffCoversWholeDayByDentist: {},
    });

    expect(conflicts).toEqual([{ type: "no_active_dentists", message: expect.stringContaining("no active dentists") }]);
  });

  it("flags no_active_dentists (worded for the specific dentist) when a requested dentist filter matched nobody active", () => {
    const conflicts = detectConflicts({
      requestedDentistId: "dentist-x",
      activeDentists: [],
      dentistAvailability: [],
      workingHoursByDentist: {},
      timeOffCoversWholeDayByDentist: {},
    });

    expect(conflicts[0].message).toContain("requested dentist is not active");
  });

  it("flags dentist_not_found when the requested dentist id doesn't match any active dentist", () => {
    const conflicts = detectConflicts({
      requestedDentistId: "dentist-x",
      activeDentists: [DENTIST_A],
      dentistAvailability: [withSlots(DENTIST_A.id, 1)],
      workingHoursByDentist: { [DENTIST_A.id]: [{ startTime: "09:00", endTime: "17:00" }] },
      timeOffCoversWholeDayByDentist: { [DENTIST_A.id]: false },
    });

    expect(conflicts).toEqual([{ type: "dentist_not_found", message: expect.any(String), dentistId: "dentist-x" }]);
  });

  it("has no conflicts when the dentist has open slots", () => {
    const conflicts = detectConflicts({
      activeDentists: [DENTIST_A],
      dentistAvailability: [withSlots(DENTIST_A.id, 3)],
      workingHoursByDentist: { [DENTIST_A.id]: [{ startTime: "09:00", endTime: "17:00" }] },
      timeOffCoversWholeDayByDentist: { [DENTIST_A.id]: false },
    });

    expect(conflicts).toEqual([]);
  });

  it("flags outside_business_hours when the dentist has no working-hours block that day", () => {
    const conflicts = detectConflicts({
      activeDentists: [DENTIST_A],
      dentistAvailability: [withSlots(DENTIST_A.id, 0)],
      workingHoursByDentist: { [DENTIST_A.id]: [] },
      timeOffCoversWholeDayByDentist: { [DENTIST_A.id]: false },
    });

    expect(conflicts).toEqual([
      { type: "outside_business_hours", message: expect.stringContaining("Dr. Amrani"), dentistId: DENTIST_A.id },
    ]);
  });

  it("flags time_off when a full-day time-off entry explains the empty day", () => {
    const conflicts = detectConflicts({
      activeDentists: [DENTIST_A],
      dentistAvailability: [withSlots(DENTIST_A.id, 0)],
      workingHoursByDentist: { [DENTIST_A.id]: [{ startTime: "09:00", endTime: "17:00" }] },
      timeOffCoversWholeDayByDentist: { [DENTIST_A.id]: true },
    });

    expect(conflicts).toEqual([{ type: "time_off", message: expect.stringContaining("Dr. Amrani"), dentistId: DENTIST_A.id }]);
  });

  it("flags fully_booked when working hours exist, no full-day time off, but zero slots remain", () => {
    const conflicts = detectConflicts({
      activeDentists: [DENTIST_A],
      dentistAvailability: [withSlots(DENTIST_A.id, 0)],
      workingHoursByDentist: { [DENTIST_A.id]: [{ startTime: "09:00", endTime: "17:00" }] },
      timeOffCoversWholeDayByDentist: { [DENTIST_A.id]: false },
    });

    expect(conflicts).toEqual([{ type: "fully_booked", message: expect.stringContaining("Dr. Amrani"), dentistId: DENTIST_A.id }]);
  });

  it("evaluates each dentist independently across a mixed multi-dentist day", () => {
    const conflicts = detectConflicts({
      activeDentists: [DENTIST_A, DENTIST_B],
      dentistAvailability: [withSlots(DENTIST_A.id, 2), withSlots(DENTIST_B.id, 0)],
      workingHoursByDentist: {
        [DENTIST_A.id]: [{ startTime: "09:00", endTime: "17:00" }],
        [DENTIST_B.id]: [{ startTime: "09:00", endTime: "17:00" }],
      },
      timeOffCoversWholeDayByDentist: { [DENTIST_A.id]: false, [DENTIST_B.id]: true },
    });

    // Dentist A has slots -> no conflict for them; only Dentist B (on time off) is flagged.
    expect(conflicts).toEqual([{ type: "time_off", message: expect.stringContaining("Dr. Bennis"), dentistId: DENTIST_B.id }]);
  });
});
