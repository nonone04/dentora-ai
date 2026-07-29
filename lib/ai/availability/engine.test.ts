import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

/** Real, generic in-memory filterable fake -- same shape as query.test.ts's, extended with a `clinics` table since assertActionAllowed (called internally by the engine) queries it. */
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

// assertActionAllowed (lib/ai/permissions.ts, called internally by getAvailabilityForState)
// creates its own admin client rather than accepting one as a parameter, so it has to be
// mocked at the module level to see the same fake data as the client passed in explicitly.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { getAvailabilityForState, isAppointmentRelatedIntent } = await import("@/lib/ai/availability/engine");
const { createInitialState } = await import("@/lib/ai/state/factory");
const { EMPTY_ENTITIES } = await import("@/lib/ai/nlu/types");

const DATE = "2026-08-10";
const ALL_DAYS_WORKING_HOURS = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
  dentist_id: "dentist-a",
  day_of_week: dayOfWeek,
  start_time: "09:00",
  end_time: "10:00",
}));

const ALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: ["check_availability"] } } };
const DISALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: [] } } };

function baseTables(clinicRow: Row = ALLOWED_CLINIC): Record<string, Row[]> {
  return {
    clinics: [clinicRow],
    dentists: [{ id: "dentist-a", clinic_id: "clinic-1", full_name: "Dr. Amrani", is_active: true }],
    dentist_working_hours: ALL_DAYS_WORKING_HOURS,
    dentist_time_off: [],
    appointments: [],
    services: [],
  };
}

function stateWith(overrides: Partial<ReturnType<typeof createInitialState>> = {}) {
  return { ...createInitialState({ clinicId: "clinic-1", conversationId: "conv-1" }), ...overrides };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("isAppointmentRelatedIntent", () => {
  it("is true for booking-flow intents", () => {
    expect(isAppointmentRelatedIntent("book_appointment")).toBe(true);
    expect(isAppointmentRelatedIntent("reschedule_appointment")).toBe(true);
    expect(isAppointmentRelatedIntent("check_availability")).toBe(true);
  });

  it("is false for everything else", () => {
    expect(isAppointmentRelatedIntent("ask_faq")).toBe(false);
    expect(isAppointmentRelatedIntent("cancel_appointment")).toBe(false);
    expect(isAppointmentRelatedIntent("other")).toBe(false);
  });
});

describe("getAvailabilityForState: no-op cases", () => {
  it("returns null when the intent isn't appointment-related", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());
    const state = stateWith({ intent: "ask_faq", entities: { ...EMPTY_ENTITIES, date: DATE } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getAvailabilityForState(fakeSupabase as any, state)).toBeNull();
  });

  it("returns null when there is no date yet", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());
    const state = stateWith({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getAvailabilityForState(fakeSupabase as any, state)).toBeNull();
  });

  it("returns null when the date isn't a resolvable YYYY-MM-DD (a raw, unparsed phrase)", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());
    const state = stateWith({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, date: "sometime next month" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getAvailabilityForState(fakeSupabase as any, state)).toBeNull();
  });

  it("returns null when the clinic hasn't allowed check_availability", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables(DISALLOWED_CLINIC));
    const state = stateWith({ intent: "check_availability", entities: { ...EMPTY_ENTITIES, date: DATE } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await getAvailabilityForState(fakeSupabase as any, state)).toBeNull();
  });
});

describe("getAvailabilityForState: ranked options", () => {
  it("returns ranked options for the requested date when slots are open", async () => {
    fakeSupabase = makeFilterableSupabase(baseTables());
    const state = stateWith({ intent: "check_availability", entities: { ...EMPTY_ENTITIES, date: DATE } });

    const result = await getAvailabilityForState(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeSupabase as any,
      state,
      { now: new Date("2026-08-01T00:00:00Z") },
    );

    expect(result).not.toBeNull();
    expect(result?.query.date).toBe(DATE);
    expect(result?.options.length).toBeGreaterThan(0);
    expect(result?.conflicts).toEqual([]);
    expect(result?.fallbacks).toEqual([]);
  });

  it("resolves a raw service/dentist mention from the conversation state into real filters", async () => {
    const tables = baseTables();
    tables.services = [{ id: "svc-1", clinic_id: "clinic-1", is_active: true, name_translations: { en: "Cleaning" }, default_duration_minutes: 45 }];
    fakeSupabase = makeFilterableSupabase(tables);

    const state = stateWith({
      intent: "book_appointment",
      entities: { ...EMPTY_ENTITIES, date: DATE, service: "cleaning", dentist: "Dr. Amrani" },
    });

    const result = await getAvailabilityForState(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeSupabase as any,
      state,
      { now: new Date("2026-08-01T00:00:00Z") },
    );

    expect(result?.query.serviceId).toBe("svc-1");
    expect(result?.query.dentistId).toBe("dentist-a");
    expect(result?.durationMinutes).toBe(45);
  });

  it("ranks a slot matching the preferred time-of-day higher", async () => {
    const tables = baseTables();
    tables.dentist_working_hours = [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dentist_id: "dentist-a",
      day_of_week: dayOfWeek,
      start_time: "09:00",
      end_time: "18:00",
    }));
    fakeSupabase = makeFilterableSupabase(tables);

    const state = stateWith({
      intent: "book_appointment",
      entities: { ...EMPTY_ENTITIES, date: DATE, time: "17:00" },
    });

    const result = await getAvailabilityForState(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeSupabase as any,
      state,
      { now: new Date("2026-08-01T00:00:00Z") },
    );

    expect(result?.options[0].startAt.startsWith(`${DATE}T17:00`)).toBe(true);
  });
});

describe("getAvailabilityForState: fully booked + fallback search", () => {
  it("surfaces a fully_booked conflict and finds the next available day as a fallback", async () => {
    const tables = baseTables();
    tables.appointments = [
      { dentist_id: "dentist-a", status: "scheduled", start_at: `${DATE}T09:00:00Z`, end_at: `${DATE}T09:30:00Z` },
      { dentist_id: "dentist-a", status: "scheduled", start_at: `${DATE}T09:30:00Z`, end_at: `${DATE}T10:00:00Z` },
    ];
    fakeSupabase = makeFilterableSupabase(tables);

    const state = stateWith({ intent: "check_availability", entities: { ...EMPTY_ENTITIES, date: DATE } });
    const result = await getAvailabilityForState(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeSupabase as any,
      state,
      { now: new Date("2026-08-01T00:00:00Z") },
    );

    expect(result?.options).toEqual([]);
    expect(result?.conflicts).toEqual([{ type: "fully_booked", message: expect.stringContaining("Dr. Amrani"), dentistId: "dentist-a" }]);
    expect(result?.fallbacks.length).toBeGreaterThan(0);
    expect(result?.fallbackDate).toBe("2026-08-11");
  });

  it("returns no options and no fallbacks when nothing is available anywhere in the search window", async () => {
    const tables = baseTables();
    tables.dentist_working_hours = []; // no working hours at all, any day
    fakeSupabase = makeFilterableSupabase(tables);

    const state = stateWith({ intent: "check_availability", entities: { ...EMPTY_ENTITIES, date: DATE } });
    const result = await getAvailabilityForState(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fakeSupabase as any,
      state,
      { now: new Date("2026-08-01T00:00:00Z"), fallbackSearchDays: 2 },
    );

    expect(result?.options).toEqual([]);
    expect(result?.fallbacks).toEqual([]);
    expect(result?.fallbackDate).toBeNull();
    expect(result?.conflicts[0].type).toBe("outside_business_hours");
  });
});
