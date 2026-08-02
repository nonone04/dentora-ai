import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const sendMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/notifications/provider", () => ({
  getNotificationProvider: () => ({ send: sendMock }),
}));

const { processDueNotificationDeliveries, sendDelivery } = await import("@/lib/notifications/dispatch");
const { parseNotificationDeliveryRow } = await import("@/lib/notifications/types");

function makeDeliveriesTable(seed: Row[]) {
  const rows = new Map<string, Row>(seed.map((row) => [row.id as string, { ...row }]));

  function builder() {
    let mode: "select" | "update" | null = null;
    let updatePayload: Record<string, unknown> | null = null;
    const eqFilters: Record<string, unknown> = {};
    let lteFilter: unknown = undefined;

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
      lte(_column: string, value: unknown) {
        lteFilter = value;
        return b;
      },
      order() {
        return b;
      },
      limit(n: number) {
        return { ...b, __limit: n } as typeof b;
      },
      maybeSingle() {
        return execute(true);
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute(false).then(onFulfilled, onRejected);
      },
    };

    function execute(single: boolean): Promise<{ data: unknown; error: unknown }> {
      const id = eqFilters.id as string | undefined;

      if (mode === "update" && updatePayload) {
        const existing = id ? rows.get(id) : undefined;
        if (!existing || existing.version !== eqFilters.version) return Promise.resolve({ data: null, error: null });
        const updated = { ...existing, ...updatePayload };
        rows.set(updated.id as string, updated);
        return Promise.resolve({ data: updated, error: null });
      }

      if (single) {
        const row = id ? rows.get(id) : undefined;
        return Promise.resolve({ data: row ?? null, error: null });
      }

      let matched = [...rows.values()].filter((row) => Object.entries(eqFilters).every(([k, v]) => row[k] === v));
      if (lteFilter !== undefined) matched = matched.filter((row) => (row.scheduled_for as string) <= (lteFilter as string));
      return Promise.resolve({ data: matched, error: null });
    }

    return b;
  }

  return { rows, builder };
}

function makeEventsTable(events: Row[]) {
  const byId = new Map(events.map((e) => [e.id as string, e]));
  return {
    builder: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: byId.get("event-1") ?? null, error: null }) }) }),
    }),
  };
}

function makeContextTables(): Record<string, Record<string, Row>> {
  return {
    clinics: {
      "clinic-1": { id: "clinic-1", name: "Dentora", email: "clinic@example.com", timezone: "UTC", default_language: "en", settings: {} },
    },
    patients: {},
    appointments: {},
    dentists: {},
    services: {},
    appointment_drafts: {},
  };
}

function makeFakeSupabase(params: { deliveries: Row[]; events: Row[]; contextTables?: Record<string, Record<string, Row>> }) {
  const deliveriesTable = makeDeliveriesTable(params.deliveries);
  const eventsTable = makeEventsTable(params.events);
  const contextTables = params.contextTables ?? makeContextTables();

  function staticBuilder(table: string) {
    const rows = contextTables[table] ?? {};
    const eqFilters: Record<string, unknown> = {};
    const b = {
      select: () => b,
      eq(column: string, value: unknown) {
        eqFilters[column] = value;
        return b;
      },
      maybeSingle: () => Promise.resolve({ data: (eqFilters.id ? rows[eqFilters.id as string] : null) ?? null, error: null }),
    };
    return b;
  }

  const client = {
    from: (table: string) => {
      if (table === "notification_deliveries") return deliveriesTable.builder();
      if (table === "notification_events") return eventsTable.builder();
      return staticBuilder(table);
    },
  };

  return { client, deliveriesTable };
}

const BASE_DELIVERY: Row = {
  id: "d1",
  clinic_id: "clinic-1",
  notification_event_id: "event-1",
  recipient_type: "staff",
  recipient_patient_id: null,
  recipient_address: "clinic@example.com",
  channel: "email",
  template_key: "conversation_escalated:email",
  language: "en",
  status: "pending",
  scheduled_for: new Date(Date.now() - 1000).toISOString(),
  attempts: 0,
  max_attempts: 2,
  next_attempt_at: null,
  last_error: null,
  sent_at: null,
  delivered_at: null,
  read_at: null,
  provider_message_id: null,
  archived_at: null,
  version: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const EVENT: Row = {
  id: "event-1",
  clinic_id: "clinic-1",
  type: "conversation_escalated",
  appointment_id: null,
  appointment_draft_id: null,
  patient_id: null,
  metadata: { reason: "Patient upset" },
};

beforeEach(() => {
  vi.restoreAllMocks();
  sendMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sendDelivery: success", () => {
  it("renders the template, calls the provider, and marks the delivery sent", async () => {
    sendMock.mockResolvedValue({ success: true });
    const fake = makeFakeSupabase({ deliveries: [BASE_DELIVERY], events: [EVENT] });
    const delivery = parseNotificationDeliveryRow(BASE_DELIVERY as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sendDelivery(fake.client as any, delivery);

    expect(result.ok).toBe(true);
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({ to: "clinic@example.com", body: expect.stringContaining("Patient upset") });
    expect(fake.deliveriesTable.rows.get("d1")).toMatchObject({ status: "sent", attempts: 1 });
  });

  it("persists the provider's message id when the provider returns one (e.g. WhatsApp's wamid)", async () => {
    sendMock.mockResolvedValue({ success: true, providerMessageId: "wamid.abc123" });
    const fake = makeFakeSupabase({ deliveries: [BASE_DELIVERY], events: [EVENT] });
    const delivery = parseNotificationDeliveryRow(BASE_DELIVERY as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await sendDelivery(fake.client as any, delivery);

    expect(fake.deliveriesTable.rows.get("d1")).toMatchObject({ provider_message_id: "wamid.abc123" });
  });
});

describe("sendDelivery: provider failure with retry", () => {
  it("schedules a retry (back to pending, future scheduled_for) when attempts remain", async () => {
    sendMock.mockResolvedValue({ success: false, error: "Provider unavailable" });
    const fake = makeFakeSupabase({ deliveries: [BASE_DELIVERY], events: [EVENT] });
    const delivery = parseNotificationDeliveryRow(BASE_DELIVERY as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sendDelivery(fake.client as any, delivery);

    expect(result.ok).toBe(false);
    const row = fake.deliveriesTable.rows.get("d1");
    expect(row).toMatchObject({ status: "pending", attempts: 1, last_error: "Provider unavailable" });
    expect(new Date(row!.scheduled_for as string).getTime()).toBeGreaterThan(Date.now());
  });

  it("marks the delivery permanently failed once max_attempts is reached", async () => {
    sendMock.mockResolvedValue({ success: false, error: "Provider unavailable" });
    const fake = makeFakeSupabase({ deliveries: [{ ...BASE_DELIVERY, attempts: 1, max_attempts: 2 }], events: [EVENT] });
    const delivery = parseNotificationDeliveryRow({ ...BASE_DELIVERY, attempts: 1, max_attempts: 2 } as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sendDelivery(fake.client as any, delivery);

    expect(result.ok).toBe(false);
    expect(fake.deliveriesTable.rows.get("d1")).toMatchObject({ status: "failed", attempts: 2 });
  });
});

describe("sendDelivery: missing contact address", () => {
  it("retries rather than throwing when the delivery has no recipient address", async () => {
    const noAddress = { ...BASE_DELIVERY, recipient_address: null };
    const fake = makeFakeSupabase({ deliveries: [noAddress], events: [EVENT] });
    const delivery = parseNotificationDeliveryRow(noAddress as never);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await sendDelivery(fake.client as any, delivery);

    expect(result.ok).toBe(false);
    expect(sendMock).not.toHaveBeenCalled();
    expect(fake.deliveriesTable.rows.get("d1")?.status).toBe("pending");
  });
});

describe("processDueNotificationDeliveries", () => {
  it("sends what it can and isolates one delivery's failure from the rest", async () => {
    sendMock.mockImplementation(({ to }: { to: string }) =>
      Promise.resolve(to === "clinic@example.com" ? { success: true } : { success: false, error: "boom" }),
    );

    const okDelivery = { ...BASE_DELIVERY, id: "ok", recipient_address: "clinic@example.com" };
    const badDelivery = { ...BASE_DELIVERY, id: "bad", recipient_address: "other@example.com", max_attempts: 1 };
    const fake = makeFakeSupabase({ deliveries: [okDelivery, badDelivery], events: [EVENT] });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await processDueNotificationDeliveries(fake.client as any, { limit: 10 });

    expect(result.processed).toBe(2);
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(1);
    expect(fake.deliveriesTable.rows.get("ok")?.status).toBe("sent");
    expect(fake.deliveriesTable.rows.get("bad")?.status).toBe("failed");
  });

  it("returns an empty summary when nothing is due", async () => {
    const fake = makeFakeSupabase({ deliveries: [], events: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await processDueNotificationDeliveries(fake.client as any, {});
    expect(result).toEqual({ processed: 0, sent: 0, retried: 0, failed: 0 });
  });
});
