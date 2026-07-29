import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const notifyAppointmentConfirmedMock = vi.hoisted(() => vi.fn());
const notifyAppointmentCancelledMock = vi.hoisted(() => vi.fn());
const notifyAppointmentRescheduledMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/notifications", () => ({
  notifyAppointmentConfirmed: notifyAppointmentConfirmedMock,
  notifyAppointmentCancelled: notifyAppointmentCancelledMock,
  notifyAppointmentRescheduled: notifyAppointmentRescheduledMock,
}));

// The Patient Intelligence Engine hook runs alongside the notification hook -- letting it hit the real
// module (as lib/ai/appointments/store.test.ts already does, unmocked) is fine as long as patient_id is
// never set on the fixtures below, which makes it a guaranteed early-return no-op.
const { transitionAppointment } = await import("@/lib/ai/appointments/store");

/** Minimal CAS table -- same shape as lib/ai/appointments/store.test.ts's makeCasTable. */
function makeCasTable(seed?: Row) {
  const rows = new Map<string, Row>(seed ? [[seed.id as string, { ...seed }]] : []);
  function builder() {
    let mode: "select" | "update" | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};
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
      maybeSingle() {
        return execute();
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute().then(onFulfilled, onRejected);
      },
    };
    function execute(): Promise<{ data: unknown; error: unknown }> {
      const id = eqFilters.id as string | undefined;
      const existing = id ? rows.get(id) : undefined;
      const matches = (row: Row) => Object.entries(eqFilters).every(([k, v]) => row[k] === v);
      if (mode === "update" && updatePayload) {
        if (!existing || !matches(existing)) return Promise.resolve({ data: null, error: null });
        const updated = { ...existing, ...updatePayload };
        rows.set(updated.id as string, updated);
        return Promise.resolve({ data: updated, error: null });
      }
      if (!existing || !matches(existing)) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: existing, error: null });
    }
    return b;
  }
  return { rows, builder };
}

function makeEventsTable() {
  const events: Row[] = [];
  function builder() {
    let mode: "select" | "insert" | null = null;
    let insertPayload: Row | null = null;
    const eqFilters: Record<string, unknown> = {};
    let limitN: number | null = null;
    const b = {
      select() {
        if (mode === null) mode = "select";
        return b;
      },
      insert(payload: Row) {
        mode = "insert";
        insertPayload = payload;
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      order() {
        return b;
      },
      limit(n: number) {
        limitN = n;
        return b;
      },
      maybeSingle() {
        return execute();
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute().then(onFulfilled, onRejected);
      },
    };
    function execute(): Promise<{ data: unknown; error: unknown }> {
      if (mode === "insert" && insertPayload) {
        events.push({ ...insertPayload });
        return Promise.resolve({ data: insertPayload, error: null });
      }
      let matches = events.filter((e) => Object.entries(eqFilters).every(([k, v]) => e[k] === v));
      if (limitN !== null) matches = matches.slice(0, limitN);
      return Promise.resolve({ data: matches[0] ?? null, error: null });
    }
    return b;
  }
  return { events, builder };
}

function makeFakeSupabase(appointment: Row) {
  const appointmentsTable = makeCasTable(appointment);
  const eventsTable = makeEventsTable();
  const notificationsBuilder = (): Row => ({
    select: () => notificationsBuilder(),
    update: () => notificationsBuilder(),
    eq: () => notificationsBuilder(),
    then: (onFulfilled: (v: { data: unknown; error: unknown }) => unknown) => Promise.resolve({ data: [], error: null }).then(onFulfilled),
  });
  const notificationsTable = { builder: notificationsBuilder };

  const client = {
    from: (table: string) => {
      if (table === "appointments") return appointmentsTable.builder();
      if (table === "appointment_lifecycle_events") return eventsTable.builder();
      if (table === "notifications") return notificationsTable.builder();
      throw new Error(`unexpected table in test fake: ${table}`);
    },
  };
  return { client };
}

beforeEach(() => {
  vi.restoreAllMocks();
  notifyAppointmentConfirmedMock.mockReset();
  notifyAppointmentCancelledMock.mockReset();
  notifyAppointmentRescheduledMock.mockReset();
});

describe("transitionAppointment: Notification & Communication Platform wiring", () => {
  it("notifies the patient on confirm", async () => {
    const fake = makeFakeSupabase({ id: "appt-1", clinic_id: "clinic-1", status: "scheduled", patient_id: "patient-1" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transitionAppointment(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", event: "confirm", actor: "staff" });

    expect(notifyAppointmentConfirmedMock).toHaveBeenCalledWith(
      fake.client,
      expect.objectContaining({ clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" }),
    );
    expect(notifyAppointmentCancelledMock).not.toHaveBeenCalled();
    expect(notifyAppointmentRescheduledMock).not.toHaveBeenCalled();
  });

  it("notifies the patient on cancel, forwarding the reason", async () => {
    const fake = makeFakeSupabase({ id: "appt-1", clinic_id: "clinic-1", status: "confirmed", patient_id: "patient-1" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "cancel",
      actor: "ai_assistant",
      reason: "Patient is sick",
    });

    expect(notifyAppointmentCancelledMock).toHaveBeenCalledWith(
      fake.client,
      expect.objectContaining({ clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1", reason: "Patient is sick" }),
    );
  });

  it("notifies the patient on reschedule", async () => {
    const fake = makeFakeSupabase({
      id: "appt-1",
      clinic_id: "clinic-1",
      status: "confirmed",
      patient_id: "patient-1",
      start_at: "2026-08-05T09:00:00Z",
      end_at: "2026-08-05T09:30:00Z",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "reschedule",
      actor: "ai_assistant",
      newStartAt: "2026-08-06T10:00:00Z",
      newEndAt: "2026-08-06T10:30:00Z",
    });

    expect(notifyAppointmentRescheduledMock).toHaveBeenCalledWith(
      fake.client,
      expect.objectContaining({ clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" }),
    );
  });

  it("does not fire any notification for events with no patient-facing template (e.g. check_in)", async () => {
    const fake = makeFakeSupabase({ id: "appt-1", clinic_id: "clinic-1", status: "confirmed", patient_id: "patient-1" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transitionAppointment(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", event: "check_in", actor: "staff" });

    expect(notifyAppointmentConfirmedMock).not.toHaveBeenCalled();
    expect(notifyAppointmentCancelledMock).not.toHaveBeenCalled();
    expect(notifyAppointmentRescheduledMock).not.toHaveBeenCalled();
  });

  it("no duplicate notifications: a repeated confirm event only notifies once, since the second call is rejected before the hook ever runs", async () => {
    const fake = makeFakeSupabase({ id: "appt-1", clinic_id: "clinic-1", status: "scheduled", patient_id: "patient-1" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = await transitionAppointment(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", event: "confirm", actor: "staff" });
    expect(first).toMatchObject({ ok: true, toStatus: "confirmed" });

    // Same event fired again against the identical appointment (e.g. a retried webhook, a double-clicked
    // approval button) -- transitionAppointment re-derives the *current* status (now "confirmed") before
    // validating the event, so "confirm" from "confirmed" is rejected as invalid_transition, and the
    // notification hook is never reached a second time. This is where the "no duplicate notifications"
    // guarantee actually lives -- not a DB uniqueness constraint (there isn't one).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = await transitionAppointment(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", event: "confirm", actor: "staff" });
    expect(second).toMatchObject({ ok: false, reason: "invalid_transition" });

    expect(notifyAppointmentConfirmedMock).toHaveBeenCalledTimes(1);
  });

  it("never lets a notification hook failure affect the transition's own success", async () => {
    notifyAppointmentConfirmedMock.mockRejectedValue(new Error("provider down"));
    const fake = makeFakeSupabase({ id: "appt-1", clinic_id: "clinic-1", status: "scheduled", patient_id: "patient-1" });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", event: "confirm", actor: "staff" });

    expect(outcome).toEqual({ ok: true, fromStatus: "scheduled", toStatus: "confirmed" });
  });
});
