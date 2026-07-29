import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordDraftCreated, transitionAppointment, transitionDraft } from "@/lib/ai/appointments/store";

type Row = Record<string, unknown>;

/** Real insert/CAS-update in-memory table, keyed by id -- same interceptor pattern proven in lib/ai/state/store.test.ts, applied here to appointments/appointment_drafts. */
function makeCasTable(seed?: Row) {
  const rows = new Map<string, Row>(seed ? [[seed.id as string, { ...seed }]] : []);
  let updateInterceptor: ((row: Row) => Row) | null = null;
  let interceptorPersistent = false;
  let updateAttempts = 0;

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
      let existing = id ? rows.get(id) : undefined;

      if (mode === "update" && updatePayload) {
        updateAttempts += 1;
        if (updateInterceptor && existing) {
          existing = updateInterceptor(existing);
          rows.set(existing.id as string, existing);
          if (!interceptorPersistent) updateInterceptor = null;
        }
        if (!existing || !matchesFilters(existing, eqFilters)) return Promise.resolve({ data: null, error: null });
        const updated = { ...existing, ...updatePayload };
        rows.set(updated.id as string, updated);
        return Promise.resolve({ data: updated, error: null });
      }

      if (!existing || !matchesFilters(existing, eqFilters)) return Promise.resolve({ data: null, error: null });
      return Promise.resolve({ data: existing, error: null });
    }

    return b;
  }

  function matchesFilters(row: Row, filters: Record<string, unknown>): boolean {
    return Object.entries(filters).every(([key, value]) => row[key] === value);
  }

  return {
    rows,
    builder,
    get updateAttempts() {
      return updateAttempts;
    },
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

/** Append-only event log with order/limit support for the "latest event" lookup transitionAppointment/transitionDraft do. */
function makeEventsTable() {
  const events: Row[] = [];

  function builder() {
    let mode: "select" | "insert" | null = null;
    let insertPayload: Row | null = null;
    const eqFilters: Record<string, unknown> = {};
    let orderDescending = false;
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
      order(_column: string, opts?: { ascending?: boolean }) {
        orderDescending = opts?.ascending === false;
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
        const row = { ...insertPayload, created_at: new Date(Date.now() + events.length).toISOString() };
        events.push(row);
        return Promise.resolve({ data: row, error: null });
      }

      let matches = events.filter((event) => Object.entries(eqFilters).every(([key, value]) => event[key] === value));
      if (orderDescending) {
        matches = [...matches].sort((a, b2) => ((a.created_at as string) < (b2.created_at as string) ? 1 : -1));
      }
      if (limitN !== null) matches = matches.slice(0, limitN);
      return Promise.resolve({ data: matches[0] ?? null, error: null });
    }

    return b;
  }

  return { events, builder };
}

/** Simple filterable table for `notifications` -- update-with-eq-filters, no CAS needed. */
function makeSimpleTable(seed: Row[] = []) {
  const rows: Row[] = [...seed];

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
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute().then(onFulfilled, onRejected);
      },
    };

    function execute(): Promise<{ data: unknown; error: unknown }> {
      const matches = rows.filter((row) => Object.entries(eqFilters).every(([key, value]) => row[key] === value));
      if (mode === "update" && updatePayload) {
        for (const row of matches) Object.assign(row, updatePayload);
      }
      return Promise.resolve({ data: matches, error: null });
    }

    return b;
  }

  return { rows, builder };
}

function makeFakeSupabase(params: { appointment?: Row; draft?: Row; notifications?: Row[] }) {
  const appointmentsTable = makeCasTable(params.appointment);
  const draftsTable = makeCasTable(params.draft);
  const eventsTable = makeEventsTable();
  const notificationsTable = makeSimpleTable(params.notifications ?? []);

  const client = {
    from(table: string) {
      if (table === "appointments") return appointmentsTable.builder();
      if (table === "appointment_drafts") return draftsTable.builder();
      if (table === "appointment_lifecycle_events") return eventsTable.builder();
      if (table === "notifications") return notificationsTable.builder();
      throw new Error(`unexpected table in test fake: ${table}`);
    },
  };

  return { client, appointmentsTable, draftsTable, eventsTable, notificationsTable };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("transitionAppointment: happy path", () => {
  it("confirms a scheduled appointment and records the audit event", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", clinic_id: "clinic-1", status: "scheduled" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "confirm",
      actor: "staff",
      actorId: "user-1",
    });

    expect(outcome).toEqual({ ok: true, fromStatus: "scheduled", toStatus: "confirmed" });
    expect(fake.appointmentsTable.rows.get("appt-1")?.status).toBe("confirmed");

    expect(fake.eventsTable.events).toHaveLength(1);
    expect(fake.eventsTable.events[0]).toMatchObject({
      clinic_id: "clinic-1",
      entity_type: "appointment",
      appointment_id: "appt-1",
      event: "confirm",
      from_status: "scheduled",
      to_status: "confirmed",
      actor: "staff",
      actor_id: "user-1",
    });
  });

  it("reschedules an appointment, updating start_at/end_at without changing status", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", clinic_id: "clinic-1", status: "confirmed", start_at: "2026-08-05T09:00:00Z", end_at: "2026-08-05T09:30:00Z" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "reschedule",
      actor: "ai_assistant",
      conversationId: "conv-1",
      newStartAt: "2026-08-06T10:00:00Z",
      newEndAt: "2026-08-06T10:30:00Z",
    });

    expect(outcome).toEqual({ ok: true, fromStatus: "confirmed", toStatus: "confirmed" });
    expect(fake.appointmentsTable.rows.get("appt-1")).toMatchObject({
      status: "confirmed",
      start_at: "2026-08-06T10:00:00Z",
      end_at: "2026-08-06T10:30:00Z",
    });
    expect(fake.eventsTable.events[0]).toMatchObject({ event: "reschedule", conversation_id: "conv-1" });
  });

  it("skips pending reminder notifications when an appointment is cancelled", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", clinic_id: "clinic-1", status: "confirmed" },
      notifications: [
        { id: "notif-1", appointment_id: "appt-1", status: "pending" },
        { id: "notif-2", appointment_id: "appt-1", status: "sent" },
        { id: "notif-3", appointment_id: "other-appt", status: "pending" },
      ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "cancel",
      actor: "ai_assistant",
    });

    expect(fake.notificationsTable.rows.find((n) => n.id === "notif-1")?.status).toBe("skipped");
    expect(fake.notificationsTable.rows.find((n) => n.id === "notif-2")?.status).toBe("sent"); // already sent -- untouched
    expect(fake.notificationsTable.rows.find((n) => n.id === "notif-3")?.status).toBe("pending"); // different appointment -- untouched
  });

  it("supports the full granular path: check_in -> start -> complete", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", clinic_id: "clinic-1", status: "confirmed" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = fake.client as any;

    const checkedIn = await transitionAppointment(client, { clinicId: "clinic-1", appointmentId: "appt-1", event: "check_in", actor: "staff" });
    expect(checkedIn).toEqual({ ok: true, fromStatus: "confirmed", toStatus: "checked_in" });
    // check_in has no matching appointments.status value -- the coarse column stays "confirmed".
    expect(fake.appointmentsTable.rows.get("appt-1")?.status).toBe("confirmed");

    const started = await transitionAppointment(client, { clinicId: "clinic-1", appointmentId: "appt-1", event: "start", actor: "staff" });
    expect(started).toEqual({ ok: true, fromStatus: "checked_in", toStatus: "in_progress" });

    const completed = await transitionAppointment(client, { clinicId: "clinic-1", appointmentId: "appt-1", event: "complete", actor: "staff" });
    expect(completed).toEqual({ ok: true, fromStatus: "in_progress", toStatus: "completed" });
    expect(fake.appointmentsTable.rows.get("appt-1")?.status).toBe("completed");
  });
});

describe("transitionAppointment: invalid transitions", () => {
  it("rejects cancelling an already-completed appointment without writing anything", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", clinic_id: "clinic-1", status: "completed" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "cancel",
      actor: "ai_assistant",
    });

    expect(outcome).toEqual({ ok: false, reason: "invalid_transition", message: expect.any(String) });
    expect(fake.appointmentsTable.rows.get("appt-1")?.status).toBe("completed");
    expect(fake.eventsTable.events).toHaveLength(0);
  });

  it("returns not_found for a nonexistent appointment", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", clinic_id: "clinic-1", status: "scheduled" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "does-not-exist",
      event: "cancel",
      actor: "ai_assistant",
    });

    expect(outcome).toEqual({ ok: false, reason: "not_found" });
  });

  it("returns not_found (recovers) rather than throwing when the initial read errors", async () => {
    // A minimal client whose appointments query always errors -- simulates a transient DB blip on the very first read.
    const erroringClient = {
      from(table: string) {
        if (table === "appointments") {
          const b = {
            select: () => b,
            eq: () => b,
            maybeSingle: () => Promise.resolve({ data: null, error: { message: "connection reset" } }),
          };
          return b;
        }
        throw new Error(`unexpected table: ${table}`);
      },
    };

    await expect(
      transitionAppointment(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        erroringClient as any,
        { clinicId: "clinic-1", appointmentId: "appt-1", event: "cancel", actor: "ai_assistant" },
      ),
    ).resolves.toEqual({ ok: false, reason: "not_found" });
  });
});

describe("transitionAppointment: concurrent updates", () => {
  it("retries and succeeds when a concurrent transition landed first but the event is still valid from the new status", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", clinic_id: "clinic-1", status: "scheduled" } });

    // Simulate another process confirming the appointment in between our read and our write -- "cancel" is valid from both "scheduled" and "confirmed", so the retry should succeed.
    fake.appointmentsTable.interceptNextUpdate((row) => ({ ...row, status: "confirmed" }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "cancel",
      actor: "ai_assistant",
    });

    expect(outcome).toEqual({ ok: true, fromStatus: "confirmed", toStatus: "cancelled" });
    expect(fake.appointmentsTable.rows.get("appt-1")?.status).toBe("cancelled");
    expect(fake.appointmentsTable.updateAttempts).toBe(2);
    expect(fake.eventsTable.events).toHaveLength(1);
  });

  it("re-validates after a conflict and rejects if the concurrent change made the event invalid", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", clinic_id: "clinic-1", status: "scheduled" } });

    // Someone else completed the appointment concurrently -- "confirm" is not valid from "completed".
    fake.appointmentsTable.interceptNextUpdate((row) => ({ ...row, status: "completed" }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "confirm",
      actor: "ai_assistant",
    });

    expect(outcome).toEqual({ ok: false, reason: "invalid_transition", message: expect.any(String) });
    expect(fake.appointmentsTable.rows.get("appt-1")?.status).toBe("completed"); // untouched by our failed attempt
    expect(fake.eventsTable.events).toHaveLength(0);
  });

  it("gives up after exhausting retries and reports a conflict rather than looping forever", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", clinic_id: "clinic-1", status: "scheduled" } });

    let toggle = false;
    fake.appointmentsTable.interceptEveryUpdate((row) => {
      toggle = !toggle;
      return { ...row, status: toggle ? "confirmed" : "scheduled" };
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionAppointment(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      event: "cancel",
      actor: "ai_assistant",
    });

    expect(outcome).toEqual({ ok: false, reason: "conflict" });
    expect(fake.appointmentsTable.updateAttempts).toBe(2);
    expect(fake.eventsTable.events).toHaveLength(0);
  });
});

describe("transitionDraft", () => {
  it("approves a proposed draft and records the audit event", async () => {
    const fake = makeFakeSupabase({ draft: { id: "draft-1", clinic_id: "clinic-1", status: "proposed" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionDraft(fake.client as any, {
      clinicId: "clinic-1",
      draftId: "draft-1",
      event: "approve",
      actor: "staff",
      actorId: "user-1",
    });

    expect(outcome).toEqual({ ok: true, fromStatus: "draft", toStatus: "draft_approved" });
    expect(fake.draftsTable?.rows.get("draft-1")?.status).toBe("confirmed");
    expect(fake.eventsTable.events[0]).toMatchObject({ entity_type: "draft", appointment_draft_id: "draft-1", event: "approve" });
  });

  it("rejects re-reviewing an already-reviewed draft", async () => {
    const fake = makeFakeSupabase({ draft: { id: "draft-1", clinic_id: "clinic-1", status: "rejected" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionDraft(fake.client as any, {
      clinicId: "clinic-1",
      draftId: "draft-1",
      event: "approve",
      actor: "staff",
    });

    expect(outcome).toEqual({ ok: false, reason: "invalid_transition", message: expect.any(String) });
  });

  it("archives a rejected draft", async () => {
    const fake = makeFakeSupabase({ draft: { id: "draft-1", clinic_id: "clinic-1", status: "rejected" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionDraft(fake.client as any, {
      clinicId: "clinic-1",
      draftId: "draft-1",
      event: "archive",
      actor: "system",
    });

    expect(outcome).toEqual({ ok: true, fromStatus: "draft_rejected", toStatus: "archived" });
  });

  it("re-validates through the same retry mechanism as transitionAppointment when a concurrent review lands first", async () => {
    const fake = makeFakeSupabase({ draft: { id: "draft-1", clinic_id: "clinic-1", status: "proposed" } });
    // Unlike appointments (where e.g. "cancel" is valid from both scheduled and confirmed), every draft
    // transition moves it to a brand-new terminal-ish state with a disjoint set of valid next events -- so
    // a concurrent review always invalidates a still-in-flight attempt on retry, rather than letting it
    // silently succeed against stale intent. This asserts that correct, safer behavior.
    fake.draftsTable!.interceptNextUpdate((row) => ({ ...row, status: "rejected" }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await transitionDraft(fake.client as any, {
      clinicId: "clinic-1",
      draftId: "draft-1",
      event: "approve",
      actor: "staff",
    });

    expect(outcome).toEqual({ ok: false, reason: "invalid_transition", message: expect.any(String) });
    expect(fake.draftsTable!.rows.get("draft-1")?.status).toBe("rejected"); // the concurrent reviewer's outcome stands
    expect(fake.eventsTable.events).toHaveLength(0);
  });
});

describe("recordDraftCreated", () => {
  it("logs the initial create_draft event with no prior status", async () => {
    const fake = makeFakeSupabase({ draft: { id: "draft-1", clinic_id: "clinic-1", status: "proposed" } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordDraftCreated(fake.client as any, {
      clinicId: "clinic-1",
      appointmentDraftId: "draft-1",
      actor: "ai_assistant",
      conversationId: "conv-1",
    });

    expect(fake.eventsTable.events).toHaveLength(1);
    expect(fake.eventsTable.events[0]).toMatchObject({
      entity_type: "draft",
      appointment_draft_id: "draft-1",
      event: "create_draft",
      from_status: null,
      to_status: "draft",
      actor: "ai_assistant",
      conversation_id: "conv-1",
    });
  });
});
