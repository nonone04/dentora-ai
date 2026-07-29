import { describe, expect, it } from "vitest";
import { fetchDentistScheduleData, queryDentistAvailability, resolveDurationMinutes } from "@/lib/ai/availability/query";

type Row = Record<string, unknown>;

/** A real, generic in-memory filterable fake -- unlike a static-canned-response builder, this actually applies .eq()/.lte()/.gte() so multi-dentist, multi-table scenarios behave like the real query. */
function makeFilterableSupabase(tables: Record<string, Row[]>) {
  return {
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        neq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] !== value);
          return builder;
        },
        lte(column: string, value: unknown) {
          rows = rows.filter((row) => (row[column] as string) <= (value as string));
          return builder;
        },
        gte(column: string, value: unknown) {
          rows = rows.filter((row) => (row[column] as string) >= (value as string));
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };
}

const DATE = "2026-08-10";
const DAY_OF_WEEK = new Date(`${DATE}T00:00:00Z`).getUTCDay();

function baseTables(): Record<string, Row[]> {
  return {
    dentists: [
      { id: "dentist-a", clinic_id: "clinic-1", full_name: "Dr. Amrani", is_active: true },
      { id: "dentist-b", clinic_id: "clinic-1", full_name: "Dr. Bennis", is_active: true },
      { id: "dentist-inactive", clinic_id: "clinic-1", full_name: "Dr. Retired", is_active: false },
    ],
    dentist_working_hours: [
      { dentist_id: "dentist-a", day_of_week: DAY_OF_WEEK, start_time: "09:00", end_time: "12:00" },
      // dentist-b intentionally has no working-hours row for this day -- a day off.
    ],
    dentist_time_off: [],
    appointments: [],
    services: [{ id: "svc-1", clinic_id: "clinic-1", default_duration_minutes: 45 }],
  };
}

describe("resolveDurationMinutes", () => {
  it("defaults to 30 minutes with no service", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveDurationMinutes(makeFilterableSupabase(baseTables()) as any, "clinic-1", null)).toBe(30);
  });

  it("uses the service's own duration when given", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await resolveDurationMinutes(makeFilterableSupabase(baseTables()) as any, "clinic-1", "svc-1")).toBe(45);
  });

  it("throws for an explicit serviceId that doesn't resolve", async () => {
    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolveDurationMinutes(makeFilterableSupabase(baseTables()) as any, "clinic-1", "svc-missing"),
    ).rejects.toThrow("Service not found for this clinic.");
  });
});

describe("fetchDentistScheduleData", () => {
  it("returns only active dentists for the clinic", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { activeDentists } = await fetchDentistScheduleData(makeFilterableSupabase(baseTables()) as any, {
      clinicId: "clinic-1",
      date: DATE,
    });

    expect(activeDentists.map((d) => d.id).sort()).toEqual(["dentist-a", "dentist-b"]);
  });

  it("filters to a single requested dentist", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { activeDentists, schedules } = await fetchDentistScheduleData(makeFilterableSupabase(baseTables()) as any, {
      clinicId: "clinic-1",
      date: DATE,
      dentistId: "dentist-a",
    });

    expect(activeDentists).toHaveLength(1);
    expect(schedules).toHaveLength(1);
    expect(schedules[0].dentistId).toBe("dentist-a");
  });

  it("separates working hours, time off, and appointments per dentist", async () => {
    const tables = baseTables();
    tables.dentist_time_off = [{ dentist_id: "dentist-b", start_at: `${DATE}T09:00:00Z`, end_at: `${DATE}T17:00:00Z` }];
    tables.appointments = [
      { dentist_id: "dentist-a", status: "scheduled", start_at: `${DATE}T09:00:00Z`, end_at: `${DATE}T09:30:00Z` },
      { dentist_id: "dentist-a", status: "cancelled", start_at: `${DATE}T10:00:00Z`, end_at: `${DATE}T10:30:00Z` },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { schedules } = await fetchDentistScheduleData(makeFilterableSupabase(tables) as any, { clinicId: "clinic-1", date: DATE });

    const dentistA = schedules.find((s) => s.dentistId === "dentist-a")!;
    expect(dentistA.workingHours).toEqual([{ startTime: "09:00", endTime: "12:00" }]);
    // Only the non-cancelled appointment should count as busy.
    expect(dentistA.appointmentBlocks).toHaveLength(1);

    const dentistB = schedules.find((s) => s.dentistId === "dentist-b")!;
    expect(dentistB.workingHours).toEqual([]);
    expect(dentistB.timeOffBlocks).toHaveLength(1);
  });

  it("returns empty when no dentists are active", async () => {
    const tables = baseTables();
    tables.dentists = tables.dentists.map((d) => ({ ...d, is_active: false }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await fetchDentistScheduleData(makeFilterableSupabase(tables) as any, { clinicId: "clinic-1", date: DATE });
    expect(result).toEqual({ activeDentists: [], schedules: [] });
  });
});

describe("queryDentistAvailability (tool-facing shape)", () => {
  it("returns the per-dentist grouped slot shape the check_availability tool has always exposed", async () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const result = await queryDentistAvailability(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeFilterableSupabase(baseTables()) as any,
      { clinicId: "clinic-1", date: DATE, now },
    );

    expect(result.date).toBe(DATE);
    expect(result.durationMinutes).toBe(30);
    expect(result.dentists).toHaveLength(2);

    const dentistA = result.dentists.find((d) => d.dentistId === "dentist-a")!;
    expect(dentistA.slots.length).toBeGreaterThan(0);
    expect(dentistA.slots[0]).toHaveProperty("startAt");
    expect(dentistA.slots[0]).toHaveProperty("endAt");

    const dentistB = result.dentists.find((d) => d.dentistId === "dentist-b")!;
    expect(dentistB.slots).toEqual([]); // day off, no working hours
  });

  it("returns an empty dentist list rather than throwing when nobody is active", async () => {
    const tables = baseTables();
    tables.dentists = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await queryDentistAvailability(makeFilterableSupabase(tables) as any, { clinicId: "clinic-1", date: DATE });
    expect(result).toEqual({ date: DATE, durationMinutes: 30, dentists: [] });
  });

  it("uses the requested service's duration for slot sizing", async () => {
    const now = new Date("2026-08-01T00:00:00Z");
    const result = await queryDentistAvailability(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      makeFilterableSupabase(baseTables()) as any,
      { clinicId: "clinic-1", date: DATE, serviceId: "svc-1", now },
    );

    expect(result.durationMinutes).toBe(45);
  });
});
