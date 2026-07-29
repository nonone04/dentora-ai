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

/** Real CAS-aware in-memory appointments table -- same pattern as lib/ai/appointments/store.test.ts. */
function makeAppointmentsTable(rows: Row[]) {
  const byId = new Map(rows.map((row) => [row.id as string, { ...row }]));

  function builder() {
    let mode: "select" | "update" | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};
    let inFilters: { column: string; values: unknown[] } | null = null;
    let gtFilter: { column: string; value: unknown } | null = null;
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
      in(column: string, values: unknown[]) {
        inFilters = { column, values };
        return b;
      },
      gt(column: string, value: unknown) {
        gtFilter = { column, value };
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
      if (inFilters) result = result.filter((row) => inFilters!.values.includes(row[inFilters!.column]));
      if (gtFilter) result = result.filter((row) => (row[gtFilter!.column] as string) > (gtFilter!.value as string));
      if (orderColumn) result = [...result].sort((a, b2) => ((a[orderColumn!] as string) < (b2[orderColumn!] as string) ? -1 : 1));
      if (limitN !== null) result = result.slice(0, limitN);
      return result;
    }

    function execute(single: boolean): Promise<{ data: unknown; error: unknown }> {
      if (mode === "update" && updatePayload) {
        const matches = candidates();
        for (const row of matches) {
          const updated = { ...row, ...updatePayload };
          byId.set(updated.id as string, updated);
        }
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

const ALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: ["cancel_appointment"] } } };
const DISALLOWED_CLINIC = { id: "clinic-1", is_active: true, settings: { ai: { enabled: true, allowedActions: [] } } };

let fakeSupabase: { from: (table: string) => unknown };
let appointmentsTable: ReturnType<typeof makeAppointmentsTable>;
let lifecycleEvents: Row[];
let notifications: Row[];

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fakeSupabase,
}));

const { cancelAppointmentTool } = await import("@/lib/ai/tools/cancel-appointment");

function setUp(appointments: Row[], clinic: Row = ALLOWED_CLINIC, seededNotifications: Row[] = []) {
  appointmentsTable = makeAppointmentsTable(appointments);
  lifecycleEvents = [];
  notifications = seededNotifications.map((n) => ({ ...n }));

  fakeSupabase = {
    from: (table: string) => {
      if (table === "appointments") return appointmentsTable.builder();
      if (table === "clinics") return makeStaticBuilder({ data: clinic, error: null });
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
      if (table === "notifications") {
        const b: Record<string, unknown> = {};
        const filters: Record<string, unknown> = {};
        b.update = (payload: Record<string, unknown>) => {
          for (const n of notifications) {
            if (Object.entries(filters).every(([k, v]) => n[k] === v)) Object.assign(n, payload);
          }
          return b;
        };
        b.eq = (column: string, value: unknown) => {
          filters[column] = value;
          return b;
        };
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

describe("cancelAppointmentTool", () => {
  it("cancels by appointmentId directly", async () => {
    setUp([{ id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", status: "confirmed" }]);

    const result = (await cancelAppointmentTool.execute({ appointmentId: "appt-1" }, { clinicId: "clinic-1" })) as {
      cancelled: boolean;
      fromStatus: string;
      toStatus: string;
    };

    expect(result).toEqual({ cancelled: true, appointmentId: "appt-1", fromStatus: "confirmed", toStatus: "cancelled" });
    expect(appointmentsTable.byId.get("appt-1")?.status).toBe("cancelled");
    expect(lifecycleEvents).toHaveLength(1);
    expect(lifecycleEvents[0]).toMatchObject({ event: "cancel", actor: "ai_assistant" });
  });

  it("resolves the appointment from patientId when appointmentId isn't given", async () => {
    setUp([
      {
        id: "appt-1",
        clinic_id: "clinic-1",
        patient_id: "patient-1",
        status: "scheduled",
        dentist_id: "d1",
        service_id: null,
        start_at: "2026-08-10T09:00:00Z",
        end_at: "2026-08-10T09:30:00Z",
      },
    ]);

    const result = (await cancelAppointmentTool.execute({ patientId: "patient-1" }, { clinicId: "clinic-1" })) as {
      appointmentId: string;
    };

    expect(result.appointmentId).toBe("appt-1");
    expect(appointmentsTable.byId.get("appt-1")?.status).toBe("cancelled");
  });

  it("records the given cancellation reason on the audit event", async () => {
    setUp([{ id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", status: "confirmed" }]);

    await cancelAppointmentTool.execute({ appointmentId: "appt-1", reason: "Feeling better" }, { clinicId: "clinic-1" });

    expect(lifecycleEvents[0]).toMatchObject({ reason: "Feeling better" });
  });

  it("skips pending reminder notifications for the cancelled appointment", async () => {
    setUp(
      [{ id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", status: "confirmed" }],
      ALLOWED_CLINIC,
      [{ id: "notif-1", appointment_id: "appt-1", status: "pending" }],
    );

    await cancelAppointmentTool.execute({ appointmentId: "appt-1" }, { clinicId: "clinic-1" });

    expect(notifications[0].status).toBe("skipped");
  });

  it("throws when neither appointmentId nor patientId is given", async () => {
    setUp([]);
    await expect(cancelAppointmentTool.execute({}, { clinicId: "clinic-1" })).rejects.toThrow(
      "patientId or appointmentId is required",
    );
  });

  it("throws when the patient has no upcoming appointment", async () => {
    setUp([]);
    await expect(cancelAppointmentTool.execute({ patientId: "patient-1" }, { clinicId: "clinic-1" })).rejects.toThrow(
      "No upcoming appointment found",
    );
  });

  it("throws a clear error for an already-completed appointment instead of silently no-op-ing", async () => {
    setUp([{ id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", status: "completed" }]);
    await expect(cancelAppointmentTool.execute({ appointmentId: "appt-1" }, { clinicId: "clinic-1" })).rejects.toThrow();
    expect(appointmentsTable.byId.get("appt-1")?.status).toBe("completed");
  });

  it("enforces the permission gate before touching anything", async () => {
    setUp([{ id: "appt-1", clinic_id: "clinic-1", patient_id: "patient-1", status: "confirmed" }], DISALLOWED_CLINIC);
    await expect(cancelAppointmentTool.execute({ appointmentId: "appt-1" }, { clinicId: "clinic-1" })).rejects.toThrow();
    expect(appointmentsTable.byId.get("appt-1")?.status).toBe("confirmed");
  });
});
