import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyDeliveryEvent,
  archiveDelivery,
  createDelivery,
  listDueDeliveries,
  loadDelivery,
  skipPendingDeliveriesForAppointment,
} from "@/lib/notifications/store";

type Row = Record<string, unknown>;

/** Real insert/CAS-update in-memory table, same interceptor pattern as lib/ai/appointments/store.test.ts's makeCasTable. */
function makeDeliveriesTable(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((row) => [row.id as string, { ...row }]));
  let nextId = seed.length + 1;
  let updateInterceptor: ((row: Row) => Row) | null = null;
  let interceptorPersistent = false;

  function builder() {
    let mode: "select" | "insert" | "update" | null = null;
    let insertPayload: Row | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};
    let inFilter: { column: string; values: unknown[] } | null = null;
    let lteFilter: { column: string; value: unknown } | null = null;
    let orderColumn: string | null = null;
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
      update(payload: Record<string, unknown>) {
        mode = "update";
        updatePayload = payload;
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      is(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      in(column: string, values: unknown[]) {
        inFilter = { column, values };
        return b;
      },
      lte(column: string, value: unknown) {
        lteFilter = { column, value };
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

    function matches(row: Row): boolean {
      if (!Object.entries(eqFilters).every(([key, value]) => row[key] === value)) return false;
      if (inFilter && !inFilter.values.includes(row[inFilter.column])) return false;
      if (lteFilter && !((row[lteFilter.column] as string) <= (lteFilter.value as string))) return false;
      return true;
    }

    function execute(single: boolean): Promise<{ data: unknown; error: unknown }> {
      if (mode === "insert" && insertPayload) {
        const row: Row = {
          id: `delivery-${nextId++}`,
          status: "pending",
          attempts: 0,
          max_attempts: 5,
          version: 1,
          next_attempt_at: null,
          last_error: null,
          sent_at: null,
          delivered_at: null,
          read_at: null,
          archived_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...insertPayload,
        };
        rows.set(row.id as string, row);
        return Promise.resolve({ data: row, error: null });
      }

      if (mode === "update" && updatePayload) {
        const id = eqFilters.id as string | undefined;
        let existing = id ? rows.get(id) : undefined;
        if (updateInterceptor && existing) {
          existing = updateInterceptor(existing);
          rows.set(existing.id as string, existing);
          if (!interceptorPersistent) updateInterceptor = null;
        }
        if (!existing || !matches(existing)) return Promise.resolve({ data: null, error: null });
        const updated: Row = { ...existing, ...updatePayload, updated_at: new Date().toISOString() };
        rows.set(updated.id as string, updated);
        return Promise.resolve({ data: updated, error: null });
      }

      let matched = [...rows.values()].filter(matches);
      if (orderColumn) matched = [...matched].sort((a, c) => ((a[orderColumn!] as string) < (c[orderColumn!] as string) ? -1 : 1));
      if (limitN !== null) matched = matched.slice(0, limitN);
      if (single) return Promise.resolve({ data: matched[0] ?? null, error: null });
      return Promise.resolve({ data: matched, error: null });
    }

    return b;
  }

  return {
    rows,
    builder,
    interceptNextUpdate(fn: (row: Row) => Row) {
      updateInterceptor = fn;
      interceptorPersistent = false;
    },
    interceptEveryUpdate(fn: (row: Row) => Row) {
      updateInterceptor = fn;
      interceptorPersistent = true;
    },
  };
}

function makeEventsTable(seed: Row[] = []) {
  const rows = seed;
  function builder() {
    const eqFilters: Record<string, unknown> = {};
    const b = {
      select() {
        return b;
      },
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        const matched = rows.filter((row) => Object.entries(eqFilters).every(([key, value]) => row[key] === value));
        return Promise.resolve({ data: matched, error: null }).then(onFulfilled, onRejected);
      },
    };
    return b;
  }
  return { builder };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("createDelivery", () => {
  it("inserts a pending delivery with defaults", async () => {
    const table = makeDeliveriesTable();
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delivery = await createDelivery(client as any, {
      clinicId: "clinic-1",
      notificationEventId: "event-1",
      recipientType: "patient",
      recipientPatientId: "patient-1",
      recipientAddress: "amina@example.com",
      channel: "email",
      templateKey: "appointment_confirmed:email",
      language: "en",
    });

    expect(delivery).toMatchObject({ status: "pending", attempts: 0, maxAttempts: 5, version: 1 });
  });
});

describe("applyDeliveryEvent", () => {
  it("applies a valid transition and bumps the version", async () => {
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", status: "pending", version: 1, attempts: 0 }]);
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await applyDeliveryEvent(client as any, {
      clinicId: "clinic-1",
      id: "d1",
      event: "start_send",
      patch: { attempts: 1 },
    });

    expect(outcome).toMatchObject({ ok: true, delivery: { status: "sending", version: 2, attempts: 1 } });
  });

  it("rejects an invalid transition without writing anything", async () => {
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", status: "failed", version: 3 }]);
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await applyDeliveryEvent(client as any, { clinicId: "clinic-1", id: "d1", event: "retry" });

    expect(outcome).toEqual({ ok: false, reason: "invalid_transition", message: expect.any(String) });
    expect(table.rows.get("d1")?.version).toBe(3);
  });

  it("returns not_found for a nonexistent delivery", async () => {
    const table = makeDeliveriesTable();
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await applyDeliveryEvent(client as any, { clinicId: "clinic-1", id: "missing", event: "start_send" });
    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("retries once and succeeds when a concurrent update landed first but the event is still valid from the new state", async () => {
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", status: "pending", version: 1, attempts: 0 }]);
    const client = { from: () => table.builder() };

    // Simulate another process already having started the send in between our read and our write --
    // "start_send" is only valid from "pending", so the first CAS attempt is lost (version mismatch);
    // the retry re-reads and finds "sending", from which "start_send" is no longer valid... instead use
    // an event valid from both: bump version only, leaving status untouched, so the first attempt's CAS
    // genuinely conflicts but the retry (reading the fresh version) succeeds normally.
    table.interceptNextUpdate((row) => ({ ...row, version: (row.version as number) + 1 }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await applyDeliveryEvent(client as any, { clinicId: "clinic-1", id: "d1", event: "start_send" });
    expect(outcome).toMatchObject({ ok: true, delivery: { status: "sending", version: 3 } });
  });

  it("gives up after exhausting retries on a persistent lost race", async () => {
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", status: "pending", version: 1 }]);
    const client = { from: () => table.builder() };

    // Every update attempt gets its version bumped by someone else first, so our CAS `.eq("version", ...)` never matches.
    table.interceptEveryUpdate((row) => ({ ...row, version: (row.version as number) + 1 }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await applyDeliveryEvent(client as any, { clinicId: "clinic-1", id: "d1", event: "start_send" });
    expect(outcome).toEqual({ ok: false, reason: "conflict" });
  });
});

describe("loadDelivery", () => {
  it("returns null for a nonexistent delivery", async () => {
    const table = makeDeliveriesTable();
    const client = { from: () => table.builder() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await loadDelivery(client as any, { clinicId: "clinic-1", id: "missing" })).toBeNull();
  });

  it("loads an existing delivery, parsed", async () => {
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", status: "sent", version: 2 }]);
    const client = { from: () => table.builder() };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const delivery = await loadDelivery(client as any, { clinicId: "clinic-1", id: "d1" });
    expect(delivery).toMatchObject({ id: "d1", status: "sent", version: 2 });
  });
});

describe("listDueDeliveries", () => {
  it("returns only pending deliveries scheduled at or before now, ordered by scheduled_for", async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const future = new Date(Date.now() + 60_000).toISOString();
    const table = makeDeliveriesTable([
      { id: "due-1", clinic_id: "clinic-1", status: "pending", scheduled_for: past, version: 1 },
      { id: "not-due", clinic_id: "clinic-1", status: "pending", scheduled_for: future, version: 1 },
      { id: "already-sent", clinic_id: "clinic-1", status: "sent", scheduled_for: past, version: 1 },
    ]);
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const due = await listDueDeliveries(client as any, {});
    expect(due.map((d) => d.id)).toEqual(["due-1"]);
  });
});

describe("archiveDelivery", () => {
  it("sets archived_at on an unarchived delivery", async () => {
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", status: "read", version: 2, archived_at: null }]);
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = await archiveDelivery(client as any, { clinicId: "clinic-1", id: "d1" });
    expect(ok).toBe(true);
    expect(table.rows.get("d1")?.archived_at).not.toBeNull();
  });

  it("is idempotent -- archiving an already-archived delivery is a no-op that still returns true", async () => {
    const archivedAt = new Date().toISOString();
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", status: "read", version: 2, archived_at: archivedAt }]);
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ok = await archiveDelivery(client as any, { clinicId: "clinic-1", id: "d1" });
    expect(ok).toBe(true);
    expect(table.rows.get("d1")?.archived_at).toBe(archivedAt);
  });

  it("does not archive a delivery belonging to another clinic", async () => {
    const table = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-2", status: "read", version: 2, archived_at: null }]);
    const client = { from: () => table.builder() };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await archiveDelivery(client as any, { clinicId: "clinic-1", id: "d1" });
    expect(table.rows.get("d1")?.archived_at).toBeNull();
  });
});

describe("skipPendingDeliveriesForAppointment", () => {
  it("marks pending deliveries tied to the appointment's events as failed, leaving others untouched", async () => {
    const events = makeEventsTable([
      { id: "event-1", clinic_id: "clinic-1", appointment_id: "appt-1" },
      { id: "event-2", clinic_id: "clinic-1", appointment_id: "other-appt" },
    ]);
    const deliveries = makeDeliveriesTable([
      { id: "d1", clinic_id: "clinic-1", notification_event_id: "event-1", status: "pending", version: 1 },
      { id: "d2", clinic_id: "clinic-1", notification_event_id: "event-1", status: "sent", version: 1 },
      { id: "d3", clinic_id: "clinic-1", notification_event_id: "event-2", status: "pending", version: 1 },
    ]);
    const client = {
      from: (table: string) => (table === "notification_events" ? events.builder() : deliveries.builder()),
    };

    await skipPendingDeliveriesForAppointment(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      { clinicId: "clinic-1", appointmentId: "appt-1", reason: "Appointment was cancelled." },
    );

    expect(deliveries.rows.get("d1")).toMatchObject({ status: "failed", last_error: "Appointment was cancelled." });
    expect(deliveries.rows.get("d2")?.status).toBe("sent"); // already sent -- untouched
    expect(deliveries.rows.get("d3")?.status).toBe("pending"); // different appointment -- untouched
  });

  it("does nothing when the appointment has no notification events at all", async () => {
    const events = makeEventsTable([]);
    const deliveries = makeDeliveriesTable([{ id: "d1", clinic_id: "clinic-1", notification_event_id: "event-1", status: "pending", version: 1 }]);
    const client = {
      from: (table: string) => (table === "notification_events" ? events.builder() : deliveries.builder()),
    };

    await skipPendingDeliveriesForAppointment(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      client as any,
      { clinicId: "clinic-1", appointmentId: "no-events", reason: "x" },
    );

    expect(deliveries.rows.get("d1")?.status).toBe("pending");
  });
});
