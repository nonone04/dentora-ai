import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

function makeStaticBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "neq", "order", "limit", "gte", "lte", "lt", "gt"]) {
    builder[method] = () => builder;
  }
  builder.maybeSingle = () => Promise.resolve(result);
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

function makeFilterableBuilder(rows: Row[]) {
  let filtered = [...rows];
  const b = {
    select() {
      return b;
    },
    eq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] === value);
      return b;
    },
    neq(column: string, value: unknown) {
      filtered = filtered.filter((row) => row[column] !== value);
      return b;
    },
    lte(column: string, value: unknown) {
      filtered = filtered.filter((row) => (row[column] as string) <= (value as string));
      return b;
    },
    gte(column: string, value: unknown) {
      filtered = filtered.filter((row) => (row[column] as string) >= (value as string));
      return b;
    },
    maybeSingle() {
      return Promise.resolve({ data: filtered[0] ?? null, error: null });
    },
    then(onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) {
      return Promise.resolve({ data: filtered, error: null }).then(onFulfilled, onRejected);
    },
  };
  return b;
}

/** Real CAS-aware in-memory appointments table -- same pattern as cancel-appointment.test.ts. */
function makeAppointmentsTable(rows: Row[]) {
  const byId = new Map(rows.map((row) => [row.id as string, { ...row }]));

  function builder() {
    let mode: "select" | "update" | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};
    const neqFilters: Record<string, unknown> = {};
    let inFilters: { column: string; values: unknown[] } | null = null;
    let gtFilter: { column: string; value: unknown } | null = null;
    let lteFilter: { column: string; value: unknown } | null = null;
    let gteFilter: { column: string; value: unknown } | null = null;
    let orderColumn: string | null = null;
    let limitN: number | null = null;

    const b = {
      select() {
        if (mode === null) mode = "select";
        return b;
      },
      update(payload: Record<string, unknown>) {
        mode = "update";
        updatePayload = payload;
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      neq(column: string, value: unknown) {
        neqFilters[column] = value;
        return b;
      },
      in(column: string, values: unknown[]) {
        inFilters = { column, values };
        return b;
      },
      gt(column: string, value: unknown) {
        gtFilter = { column, value };
        return b;
      },
      lte(column: string, value: unknown) {
        lteFilter = { column, value };
        return b;
      },
      gte(column: string, value: unknown) {
        gteFilter = { column, value };
        return b;
      },
      order(column: string) {
        orderColumn = column;
        return b;
      },
      limit(n: number) {
        limitN = n;
        return b;
      },
      maybeSingle() {
        return execute(true);
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute(false).then(onFulfilled, onRejected);
      },
    };

    function candidates(): Row[] {
      let result = [...byId.values()];
      for (const [key, value] of Object.entries(eqFilters)) result = result.filter((row) => row[key] === value);
      for (const [key, value] of Object.entries(neqFilters)) result = result.filter((row) => row[key] !== value);
      if (inFilters) result = result.filter((row) => inFilters!.values.includes(row[inFilters!.column]));
      if (gtFilter) result = result.filter((row) => (row[gtFilter!.column] as string) > (gtFilter!.value as string));
      if (lteFilter) result = result.filter((row) => (row[lteFilter!.column] as string) <= (lteFilter!.value as string));
      if (gteFilter) result = result.filter((row) => (row[gteFilter!.column] as string) >= (gteFilter!.value as string));
      if (orderColumn) result = [...result].sort((a, b2) => ((a[orderColumn!] as string) < (b2[orderColumn!] as string) ? -1 : 1));
      if (limitN !== null) result = result.slice(0, limitN);
      return result;
    }

    function execute(single: boolean): Promise<{ data: unknown; error: unknown }> {
      if (mode === "update" && updatePayload) {
        const matches = candidates();
        for (const row of matches) byId.set(row.id as string, { ...row, ...updatePayload });
        const result = matches.map((row) => byId.get(row.id as string));
        return Promise.resolve({ data: single ? (result[0] ?? null) : result, error: null });
      }
      const result = candidates();
      return Promise.resolve({ data: single ? (result[0] ?? null) : result, error: null });
    }

    return b;
  }

  return { byId, builder };
}

const ALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: ["reschedule_appointment"] } } };
const DISALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: [] } } };

const DATE = "2026-08-10";
const DAY_OF_WEEK = new Date(`${DATE}T00:00:00Z`).getUTCDay();

let fakeSupabase: { from: (table: string) => unknown };
let appointmentsTable: ReturnType<typeof makeAppointmentsTable>;
let lifecycleEvents: Row[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { rescheduleAppointmentTool } = await import("@/lib/ai/tools/reschedule-appointment");

function setUp(params: { appointments: Row[]; workingHours?: Row[]; timeOff?: Row[]; clinic?: Row }) {
  appointmentsTable = makeAppointmentsTable(params.appointments);
  lifecycleEvents = [];

  const dentists = [{ id: "dentist-a", clinic_id: "clinic-1", full_name: "Dr. Amrani", is_active: true }];
  const workingHours = params.workingHours ?? [{ dentist_id: "dentist-a", day_of_week: DAY_OF_WEEK, start_time: "09:00", end_time: "17:00" }];
  const timeOff = params.timeOff ?? [];

  fakeSupabase = {
    from: (table: string) => {
      if (table === "appointments") return appointmentsTable.builder();
      if (table === "clinics") return makeStaticBuilder({ data: params.clinic ?? ALLOWED_CLINIC, error: null });
      if (table === "dentists") return makeFilterableBuilder(dentists);
      if (table === "dentist_working_hours") return makeFilterableBuilder(workingHours);
      if (table === "dentist_time_off") return makeFilterableBuilder(timeOff);
      if (table === "appointment_lifecycle_events") {
        const b: Record<string, unknown> = {};
        for (const m of ["select", "eq", "order", "limit"]) b[m] = () => b;
        b.insert = (payload: Row) => {
          lifecycleEvents.push(payload);
          return b;
        };
        b.maybeSingle = () => Promise.resolve({ data: null, error: null });
        b.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(onFulfilled);
        return b;
      }
      throw new Error(`unexpected table: ${table}`);
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("rescheduleAppointmentTool", () => {
  it("reschedules to a valid new time within working hours", async () => {
    setUp({
      appointments: [
        { id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-a", status: "confirmed", start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T09:30:00.000Z` },
      ],
    });

    const result = (await rescheduleAppointmentTool.execute(
      { appointmentId: "appt-1", newStartAt: `${DATE}T14:00:00.000Z` },
      { clinicId: "clinic-1" },
    )) as { rescheduled: boolean; startAt: string; endAt: string };

    expect(result.rescheduled).toBe(true);
    expect(result.startAt).toBe(`${DATE}T14:00:00.000Z`);
    expect(result.endAt).toBe(`${DATE}T14:30:00.000Z`); // preserves the original 30-minute duration
    expect(appointmentsTable.byId.get("appt-1")).toMatchObject({ start_at: `${DATE}T14:00:00.000Z`, end_at: `${DATE}T14:30:00.000Z`, status: "confirmed" });
    expect(lifecycleEvents[0]).toMatchObject({ event: "reschedule" });
  });

  it("does not treat the appointment's own current slot as a conflict with itself", async () => {
    setUp({
      appointments: [
        { id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-a", status: "confirmed", start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T09:30:00.000Z` },
      ],
    });

    // Moving it just 15 minutes later, still same day -- should not collide with its own pre-move record.
    const result = (await rescheduleAppointmentTool.execute(
      { appointmentId: "appt-1", newStartAt: `${DATE}T09:15:00.000Z` },
      { clinicId: "clinic-1" },
    )) as { rescheduled: boolean };

    expect(result.rescheduled).toBe(true);
  });

  it("resolves the appointment from patientId when appointmentId isn't given", async () => {
    setUp({
      appointments: [
        { id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-a", status: "scheduled", start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T09:30:00.000Z` },
      ],
    });

    const result = (await rescheduleAppointmentTool.execute(
      { patientId: "patient-1", newStartAt: `${DATE}T15:00:00.000Z` },
      { clinicId: "clinic-1" },
    )) as { appointmentId: string };

    expect(result.appointmentId).toBe("appt-1");
  });

  it("rejects a time that conflicts with another dentist appointment", async () => {
    setUp({
      appointments: [
        { id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-a", status: "confirmed", start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T09:30:00.000Z` },
        { id: "appt-2", clinic_id: "clinic-1", patient_id: "patient-2", dentist_id: "dentist-a", status: "confirmed", start_at: `${DATE}T14:00:00.000Z`, end_at: `${DATE}T14:30:00.000Z` },
      ],
    });

    await expect(
      rescheduleAppointmentTool.execute({ appointmentId: "appt-1", newStartAt: `${DATE}T14:15:00.000Z` }, { clinicId: "clinic-1" }),
    ).rejects.toThrow("already has an appointment");

    expect(appointmentsTable.byId.get("appt-1")?.start_at).toBe(`${DATE}T09:00:00.000Z`); // untouched
  });

  it("rejects a time outside the dentist's working hours", async () => {
    setUp({
      appointments: [
        { id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-a", status: "confirmed", start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T09:30:00.000Z` },
      ],
    });

    await expect(
      rescheduleAppointmentTool.execute({ appointmentId: "appt-1", newStartAt: `${DATE}T20:00:00.000Z` }, { clinicId: "clinic-1" }),
    ).rejects.toThrow("outside the dentist's working hours");
  });

  it("rejects a time during the dentist's time off", async () => {
    setUp({
      appointments: [
        { id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-a", status: "confirmed", start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T09:30:00.000Z` },
      ],
      timeOff: [{ dentist_id: "dentist-a", start_at: `${DATE}T13:00:00Z`, end_at: `${DATE}T15:00:00Z` }],
    });

    await expect(
      rescheduleAppointmentTool.execute({ appointmentId: "appt-1", newStartAt: `${DATE}T14:00:00.000Z` }, { clinicId: "clinic-1" }),
    ).rejects.toThrow("already has an appointment");
  });

  it("throws when newStartAt is missing", async () => {
    setUp({ appointments: [] });
    await expect(rescheduleAppointmentTool.execute({ appointmentId: "appt-1" }, { clinicId: "clinic-1" })).rejects.toThrow(
      "newStartAt is required",
    );
  });

  it("throws when newStartAt is invalid", async () => {
    setUp({ appointments: [] });
    await expect(
      rescheduleAppointmentTool.execute({ appointmentId: "appt-1", newStartAt: "not-a-date" }, { clinicId: "clinic-1" }),
    ).rejects.toThrow("newStartAt is invalid");
  });

  it("throws when neither appointmentId nor patientId is given", async () => {
    setUp({ appointments: [] });
    await expect(
      rescheduleAppointmentTool.execute({ newStartAt: `${DATE}T09:00:00.000Z` }, { clinicId: "clinic-1" }),
    ).rejects.toThrow("patientId or appointmentId is required");
  });

  it("enforces the permission gate before touching anything", async () => {
    setUp({
      appointments: [
        { id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", dentist_id: "dentist-a", status: "confirmed", start_at: `${DATE}T09:00:00.000Z`, end_at: `${DATE}T09:30:00.000Z` },
      ],
      clinic: DISALLOWED_CLINIC,
    });

    await expect(
      rescheduleAppointmentTool.execute({ appointmentId: "appt-1", newStartAt: `${DATE}T14:00:00.000Z` }, { clinicId: "clinic-1" }),
    ).rejects.toThrow();
    expect(appointmentsTable.byId.get("appt-1")?.start_at).toBe(`${DATE}T09:00:00.000Z`);
  });
});
