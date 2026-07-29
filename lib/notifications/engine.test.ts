import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const sendMock = vi.hoisted(() => vi.fn(() => Promise.resolve({ success: true })));

vi.mock("@/lib/notifications/provider", () => ({
  getNotificationProvider: () => ({ send: sendMock }),
}));

const {
  createNotificationEvent,
  notifyAppointmentBooked,
  notifyAppointmentCancelled,
  notifyAppointmentConfirmed,
  notifyAppointmentRescheduled,
  notifyEscalation,
} = await import("@/lib/notifications/engine");

/**
 * Deferred-execution fake (matches the pattern in store.test.ts/
 * dispatch.test.ts): every filter/mode method just records intent, and
 * the actual match/mutate only happens in execute(), called by
 * maybeSingle()/then() once the whole chain has been built -- crucially
 * *after* every .eq()/.in()/.lte() in the chain has run, regardless of
 * whether they were called before or after .update()/.insert().
 */
function makeInsertRecordingTable(rows: Row[] = []) {
  let nextId = rows.length + 1;
  function builder() {
    let mode: "select" | "insert" | "update" | null = null;
    let insertPayload: Row | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};
    let inFilter: { column: string; values: unknown[] } | null = null;
    let lteFilter: unknown;

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
      in(column: string, values: unknown[]) {
        inFilter = { column, values };
        return b;
      },
      lte(_column: string, value: unknown) {
        lteFilter = value;
        return b;
      },
      order() {
        return b;
      },
      limit() {
        return b;
      },
      maybeSingle() {
        return execute(true);
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute(false).then(onFulfilled, onRejected);
      },
    };

    function matchesFilters(row: Row): boolean {
      if (!Object.entries(eqFilters).every(([k, v]) => row[k] === v)) return false;
      if (inFilter && !inFilter.values.includes(row[inFilter.column])) return false;
      if (lteFilter !== undefined && !((row.scheduled_for as string) <= (lteFilter as string))) return false;
      return true;
    }

    function execute(single: boolean): Promise<{ data: unknown; error: unknown }> {
      if (mode === "insert" && insertPayload) {
        const row = { id: `row-${nextId++}`, version: 1, status: "pending", attempts: 0, max_attempts: 5, ...insertPayload };
        rows.push(row);
        return Promise.resolve({ data: row, error: null });
      }

      if (mode === "update" && updatePayload) {
        const id = eqFilters.id as string | undefined;
        const existing = id ? rows.find((r) => r.id === id) : undefined;
        if (!existing || !matchesFilters(existing)) return Promise.resolve({ data: null, error: null });
        Object.assign(existing, updatePayload);
        return Promise.resolve({ data: existing, error: null });
      }

      const matched = rows.filter(matchesFilters);
      if (single) {
        const id = eqFilters.id as string | undefined;
        const row = id ? matched.find((r) => r.id === id) : matched[0];
        return Promise.resolve({ data: row ?? null, error: null });
      }
      return Promise.resolve({ data: matched, error: null });
    }

    return b;
  }
  return { rows, builder };
}

function makeStaticTable(byId: Record<string, Row>) {
  function builder() {
    const eqFilters: Record<string, unknown> = {};
    const b = {
      select: () => b,
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      maybeSingle: () => Promise.resolve({ data: (eqFilters.id ? byId[eqFilters.id as string] : null) ?? null, error: null }),
    };
    return b;
  }
  return { builder };
}

const CLINIC: Row = {
  id: "clinic-1",
  name: "Dentora Clinic",
  email: "clinic@example.com",
  timezone: "UTC",
  default_language: "en",
  settings: { notifications: { reminderHoursBefore: 2, sendConfirmations: true } },
};

const PATIENT: Row = {
  id: "patient-1",
  full_name: "Amina",
  email: "amina@example.com",
  phone: "+212600000000",
  preferred_language: "en",
  preferred_contact_channel: "email",
  reminder_opt_in: true,
};

function futureIso(hours: number) {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function makeFakeSupabase(params: { appointment?: Row; draft?: Row; patient?: Row; clinic?: Row } = {}) {
  const eventsTable = makeInsertRecordingTable();
  const deliveriesTable = makeInsertRecordingTable();

  const staticTables: Record<string, Record<string, Row>> = {
    clinics: { "clinic-1": params.clinic ?? CLINIC },
    patients: params.patient ? { "patient-1": params.patient } : {},
    appointments: params.appointment ? { "appt-1": params.appointment } : {},
    appointment_drafts: params.draft ? { "draft-1": params.draft } : {},
    dentists: {},
    services: {},
  };

  const client = {
    from: (table: string) => {
      if (table === "notification_events") return eventsTable.builder();
      if (table === "notification_deliveries") return deliveriesTable.builder();
      return makeStaticTable(staticTables[table] ?? {}).builder();
    },
  };

  return { client, eventsTable, deliveriesTable };
}

beforeEach(() => {
  vi.restoreAllMocks();
  sendMock.mockClear();
  sendMock.mockImplementation(() => Promise.resolve({ success: true }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createNotificationEvent: staff fan-out (appointment_booked / conversation_escalated)", () => {
  it("notifies staff on both email and in_app when a draft is booked", async () => {
    const fake = makeFakeSupabase({ draft: { id: "draft-1", patient_id: null, patient_name: "Yasmine", patient_phone: null } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentBooked(fake.client as any, { clinicId: "clinic-1", appointmentDraftId: "draft-1" });

    expect(fake.eventsTable.rows).toHaveLength(1);
    expect(fake.eventsTable.rows[0]).toMatchObject({ type: "appointment_booked", appointment_draft_id: "draft-1" });
    expect(fake.deliveriesTable.rows.map((d) => d.channel).sort()).toEqual(["email", "in_app"]);
    expect(fake.deliveriesTable.rows.every((d) => d.recipient_type === "staff")).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(2); // dispatched immediately
  });

  it("skips staff notifications entirely when the clinic has no email on file", async () => {
    const fake = makeFakeSupabase({ clinic: { ...CLINIC, email: null }, draft: { id: "draft-1" } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await createNotificationEvent(fake.client as any, { clinicId: "clinic-1", type: "appointment_booked", appointmentDraftId: "draft-1" });
    expect(outcome?.deliveriesCreated).toBe(0);
  });

  it("notifies staff on escalation with the reason in metadata", async () => {
    const fake = makeFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyEscalation(fake.client as any, { clinicId: "clinic-1", conversationId: "conv-1", reason: "Upset patient" });

    expect(fake.eventsTable.rows[0]).toMatchObject({ type: "conversation_escalated", metadata: { reason: "Upset patient" } });
    expect(fake.deliveriesTable.rows).toHaveLength(2);
  });

  it("skips escalation notifications entirely when the clinic disabled the aiSummaries preference", async () => {
    const fake = makeFakeSupabase({ clinic: { ...CLINIC, settings: { notifications: { categories: { aiSummaries: false } } } } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await createNotificationEvent(fake.client as any, { clinicId: "clinic-1", type: "conversation_escalated", reason: "Upset patient" });
    expect(outcome?.deliveriesCreated).toBe(0);
  });

  it("still notifies staff on appointment_booked when aiSummaries is disabled -- that preference only gates conversation_escalated", async () => {
    const fake = makeFakeSupabase({
      clinic: { ...CLINIC, settings: { notifications: { categories: { aiSummaries: false } } } },
      draft: { id: "draft-1", patient_id: null, patient_name: "Yasmine", patient_phone: null },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentBooked(fake.client as any, { clinicId: "clinic-1", appointmentDraftId: "draft-1" });
    expect(fake.deliveriesTable.rows).toHaveLength(2);
  });

  it("only sends staff notifications on email when the clinic disabled the in-app channel", async () => {
    const fake = makeFakeSupabase({
      clinic: { ...CLINIC, settings: { notifications: { channels: { inApp: false } } } },
      draft: { id: "draft-1", patient_id: null, patient_name: "Yasmine", patient_phone: null },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentBooked(fake.client as any, { clinicId: "clinic-1", appointmentDraftId: "draft-1" });
    expect(fake.deliveriesTable.rows.map((d) => d.channel)).toEqual(["email"]);
  });
});

describe("createNotificationEvent: patient fan-out", () => {
  it("sends an immediate confirmation on the patient's preferred channel", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: PATIENT,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentConfirmed(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" });

    const confirmedEvent = fake.eventsTable.rows.find((r) => r.type === "appointment_confirmed");
    expect(confirmedEvent).toBeTruthy();
    const confirmedDelivery = fake.deliveriesTable.rows.find((d) => d.notification_event_id === confirmedEvent!.id);
    expect(confirmedDelivery).toMatchObject({ channel: "email", recipient_address: "amina@example.com", status: "sent" });
  });

  it("also schedules a future reminder when the appointment is still ahead and the patient opted in", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: PATIENT,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentConfirmed(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" });

    const reminderEvent = fake.eventsTable.rows.find((r) => r.type === "appointment_reminder");
    expect(reminderEvent).toBeTruthy();
    const reminderDelivery = fake.deliveriesTable.rows.find((d) => d.notification_event_id === reminderEvent!.id);
    expect(reminderDelivery?.status).toBe("pending"); // scheduled for later -- not dispatched immediately
    expect(new Date(reminderDelivery!.scheduled_for as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("does not schedule a reminder once the reminder window has already passed", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(1), end_at: futureIso(1.5) }, // reminderHoursBefore=2 -> would be in the past
      patient: PATIENT,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentConfirmed(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" });

    expect(fake.eventsTable.rows.find((r) => r.type === "appointment_reminder")).toBeUndefined();
  });

  it("skips the confirmation delivery (but still logs the event) when the clinic disabled confirmations", async () => {
    const fake = makeFakeSupabase({
      clinic: { ...CLINIC, settings: { notifications: { sendConfirmations: false } } },
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: PATIENT,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await createNotificationEvent(fake.client as any, {
      clinicId: "clinic-1",
      type: "appointment_confirmed",
      appointmentId: "appt-1",
      patientId: "patient-1",
    });

    expect(outcome).toMatchObject({ deliveriesCreated: 0 });
  });

  it("skips a reminder delivery for a patient who opted out", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: { ...PATIENT, reminder_opt_in: false },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await createNotificationEvent(fake.client as any, {
      clinicId: "clinic-1",
      type: "appointment_reminder",
      appointmentId: "appt-1",
      patientId: "patient-1",
    });

    expect(outcome?.deliveriesCreated).toBe(0);
  });

  it("skips a reminder delivery when the clinic disabled the appointmentReminders preference", async () => {
    const fake = makeFakeSupabase({
      clinic: { ...CLINIC, settings: { notifications: { categories: { appointmentReminders: false } } } },
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: PATIENT,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await createNotificationEvent(fake.client as any, {
      clinicId: "clinic-1",
      type: "appointment_reminder",
      appointmentId: "appt-1",
      patientId: "patient-1",
    });

    expect(outcome?.deliveriesCreated).toBe(0);
  });

  it("skips the patient's delivery entirely when the clinic disabled the email channel and that's the patient's preferred channel", async () => {
    const fake = makeFakeSupabase({
      clinic: { ...CLINIC, settings: { notifications: { channels: { email: false } } } },
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: PATIENT,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await createNotificationEvent(fake.client as any, {
      clinicId: "clinic-1",
      type: "appointment_confirmed",
      appointmentId: "appt-1",
      patientId: "patient-1",
    });

    expect(outcome?.deliveriesCreated).toBe(0);
  });

  it("cancellation skips any still-pending deliveries tied to the appointment and sends the cancellation notice", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: PATIENT,
    });

    // First, confirm (creates a pending reminder delivery).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentConfirmed(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" });
    const pendingReminder = fake.deliveriesTable.rows.find((d) => d.status === "pending");
    expect(pendingReminder).toBeTruthy();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentCancelled(fake.client as any, {
      clinicId: "clinic-1",
      appointmentId: "appt-1",
      patientId: "patient-1",
      reason: "Patient request",
    });

    expect(fake.deliveriesTable.rows.find((d) => d.id === pendingReminder!.id)?.status).toBe("failed");
    const cancelledEvent = fake.eventsTable.rows.find((r) => r.type === "appointment_cancelled");
    expect(cancelledEvent).toMatchObject({ metadata: { reason: "Patient request" } });
  });

  it("reschedule skips the old pending reminder and schedules a fresh one against the new time", async () => {
    const fake = makeFakeSupabase({
      appointment: { id: "appt-1", patient_id: "patient-1", start_at: futureIso(48), end_at: futureIso(48.5) },
      patient: PATIENT,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentConfirmed(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" });
    const staleReminder = fake.deliveriesTable.rows.find((d) => d.status === "pending");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await notifyAppointmentRescheduled(fake.client as any, { clinicId: "clinic-1", appointmentId: "appt-1", patientId: "patient-1" });

    expect(fake.deliveriesTable.rows.find((d) => d.id === staleReminder!.id)?.status).toBe("failed");
    const newReminder = fake.deliveriesTable.rows.find((d) => d.status === "pending" && d.id !== staleReminder!.id);
    expect(newReminder).toBeTruthy();
    const rescheduledEvent = fake.eventsTable.rows.find((r) => r.type === "appointment_rescheduled");
    expect(rescheduledEvent).toBeTruthy();
  });

  it("creates no deliveries when there is no resolvable patient", async () => {
    const fake = makeFakeSupabase({ appointment: { id: "appt-1", patient_id: null, start_at: futureIso(48), end_at: futureIso(48.5) } });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const outcome = await createNotificationEvent(fake.client as any, { clinicId: "clinic-1", type: "appointment_confirmed", appointmentId: "appt-1" });
    expect(outcome?.deliveriesCreated).toBe(0);
  });
});

describe("createNotificationEvent: resilience", () => {
  it("never throws, even when recording the event itself fails", async () => {
    const throwingClient = { from: () => ({ insert: () => ({ select: () => ({ maybeSingle: () => Promise.reject(new Error("db down")) }) }) }) };

    await expect(
      createNotificationEvent(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        throwingClient as any,
        { clinicId: "clinic-1", type: "conversation_escalated", reason: "x" },
      ),
    ).resolves.toBeNull();
  });
});
