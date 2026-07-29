import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

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

let fakeSupabase: ReturnType<typeof makeFilterableSupabase>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { checkAvailabilityTool } = await import("@/lib/ai/tools/check-availability");

const DATE = "2026-08-10";
const DAY_OF_WEEK = new Date(`${DATE}T00:00:00Z`).getUTCDay();
const ALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: ["check_availability"] } } };

function baseTables(): Record<string, Row[]> {
  return {
    clinics: [ALLOWED_CLINIC],
    dentists: [{ id: "dentist-a", clinic_id: "clinic-1", full_name: "Dr. Amrani", is_active: true }],
    dentist_working_hours: [{ dentist_id: "dentist-a", day_of_week: DAY_OF_WEEK, start_time: "09:00", end_time: "10:00" }],
    dentist_time_off: [],
    appointments: [],
    services: [{ id: "svc-1", clinic_id: "clinic-1", default_duration_minutes: 45 }],
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("checkAvailabilityTool (delegates to the Availability Engine)", () => {
  it("returns the same {date, durationMinutes, dentists} shape as before the refactor", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());

    const result = (await checkAvailabilityTool.execute({ date: DATE }, { clinicId: "clinic-1" })) as {
      date: string;
      durationMinutes: number;
      dentists: { dentistId: string; dentistName: string; slots: { startAt: string; endAt: string }[] }[];
    };

    expect(result.date).toBe(DATE);
    expect(result.durationMinutes).toBe(30);
    expect(result.dentists).toHaveLength(1);
    expect(result.dentists[0]).toMatchObject({ dentistId: "dentist-a", dentistName: "Dr. Amrani" });
    expect(result.dentists[0].slots.length).toBeGreaterThan(0);
  });

  it("rejects a malformed date before querying anything", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());
    await expect(checkAvailabilityTool.execute({ date: "not-a-date" }, { clinicId: "clinic-1" })).rejects.toThrow(
      "A valid date (YYYY-MM-DD) is required.",
    );
  });

  it("uses the requested service's duration", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());
    const result = (await checkAvailabilityTool.execute({ date: DATE, serviceId: "svc-1" }, { clinicId: "clinic-1" })) as {
      durationMinutes: number;
    };
    expect(result.durationMinutes).toBe(45);
  });

  it("throws for a serviceId that doesn't resolve", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());
    await expect(
      checkAvailabilityTool.execute({ date: DATE, serviceId: "svc-missing" }, { clinicId: "clinic-1" }),
    ).rejects.toThrow("Service not found for this clinic.");
  });

  it("filters to a single requested dentist", async () => {
    const tables = baseTables();
    tables.dentists.push({ id: "dentist-b", clinic_id: "clinic-1", full_name: "Dr. Bennis", is_active: true });
    fakeSupabase = makeFilterableSupabase(tables);

    const result = (await checkAvailabilityTool.execute({ date: DATE, dentistId: "dentist-a" }, { clinicId: "clinic-1" })) as {
      dentists: { dentistId: string }[];
    };
    expect(result.dentists).toHaveLength(1);
    expect(result.dentists[0].dentistId).toBe("dentist-a");
  });

  it("respects existing appointments when generating slots", async () => {
    const tables = baseTables();
    tables.appointments = [{ dentist_id: "dentist-a", status: "scheduled", start_at: `${DATE}T09:00:00Z`, end_at: `${DATE}T09:30:00Z` }];
    fakeSupabase = makeFilterableSupabase(tables);

    const result = (await checkAvailabilityTool.execute({ date: DATE }, { clinicId: "clinic-1" })) as {
      dentists: { slots: { startAt: string }[] }[];
    };
    expect(result.dentists[0].slots.map((s) => s.startAt)).not.toContain(`${DATE}T09:00:00.000Z`);
  });

  it("enforces the permission gate before querying availability", async () => {
    fakeSupabase = makeFilterableSupabase({
      clinics: [{ id: "clinic-1", is_active: true, settings: { ai: { enabled: false, allowedActions: [] } } }],
      dentists: [],
      dentist_working_hours: [],
      dentist_time_off: [],
      appointments: [],
      services: [],
    });

    await expect(checkAvailabilityTool.execute({ date: DATE }, { clinicId: "clinic-1" })).rejects.toThrow();
  });
});
