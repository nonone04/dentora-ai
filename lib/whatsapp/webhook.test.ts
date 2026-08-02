import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyWhatsAppStatusUpdate, isValidSignature } from "@/lib/whatsapp/webhook";

const APP_SECRET = "test-app-secret";

function sign(body: string, secret: string) {
  return `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("isValidSignature", () => {
  it("accepts a correctly signed body", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(isValidSignature(body, sign(body, APP_SECRET), APP_SECRET)).toBe(true);
  });

  it("rejects a body signed with the wrong secret", () => {
    const body = JSON.stringify({ hello: "world" });
    expect(isValidSignature(body, sign(body, "wrong-secret"), APP_SECRET)).toBe(false);
  });

  it("rejects a tampered body", () => {
    const original = JSON.stringify({ hello: "world" });
    const tampered = JSON.stringify({ hello: "tampered" });
    expect(isValidSignature(tampered, sign(original, APP_SECRET), APP_SECRET)).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(isValidSignature("{}", null, APP_SECRET)).toBe(false);
  });

  it("rejects a malformed signature header (wrong scheme)", () => {
    expect(isValidSignature("{}", "md5=deadbeef", APP_SECRET)).toBe(false);
  });
});

type Row = Record<string, unknown>;

/** Minimal filterable/CAS-updatable notification_deliveries fake -- same shape as lib/notifications/dispatch.test.ts's makeDeliveriesTable. */
function makeFakeSupabase(seed: Row[]) {
  const rows = new Map<string, Row>(seed.map((row) => [row.id as string, { ...row }]));

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
        return execute(true);
      },
      then(onFulfilled: (v: { data: unknown; error: unknown }) => unknown, onRejected?: (r: unknown) => unknown) {
        return execute(false).then(onFulfilled, onRejected);
      },
    };

    function matches(row: Row): boolean {
      return Object.entries(eqFilters).every(([k, v]) => row[k] === v);
    }

    function execute(single: boolean): Promise<{ data: unknown; error: unknown }> {
      if (mode === "update" && updatePayload) {
        const id = eqFilters.id as string | undefined;
        const existing = id ? rows.get(id) : undefined;
        if (!existing || !matches(existing)) return Promise.resolve({ data: null, error: null });
        const updated = { ...existing, ...updatePayload };
        rows.set(updated.id as string, updated);
        return Promise.resolve({ data: updated, error: null });
      }

      const matched = [...rows.values()].filter(matches);
      if (single) return Promise.resolve({ data: matched[0] ?? null, error: null });
      return Promise.resolve({ data: matched, error: null });
    }

    return b;
  }

  const client = { from: (_table: string) => builder() };
  return { client, rows };
}

const BASE_DELIVERY: Row = {
  id: "delivery-1",
  clinic_id: "clinic-1",
  provider_message_id: "wamid.abc123",
  status: "sent",
  version: 1,
  attempts: 1,
  max_attempts: 5,
};

describe("applyWhatsAppStatusUpdate", () => {
  it("marks a delivery delivered and stamps delivered_at", async () => {
    const fake = makeFakeSupabase([BASE_DELIVERY]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyWhatsAppStatusUpdate(fake.client as any, {
      id: "wamid.abc123",
      status: "delivered",
      timestamp: "1700000000",
      recipient_id: "15550001111",
    });

    const row = fake.rows.get("delivery-1");
    expect(row).toMatchObject({ status: "delivered" });
    expect(row?.delivered_at).toBeTruthy();
  });

  it("marks a delivery read and stamps read_at", async () => {
    const fake = makeFakeSupabase([{ ...BASE_DELIVERY, status: "delivered", version: 2 }]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyWhatsAppStatusUpdate(fake.client as any, {
      id: "wamid.abc123",
      status: "read",
      timestamp: "1700000000",
      recipient_id: "15550001111",
    });

    const row = fake.rows.get("delivery-1");
    expect(row).toMatchObject({ status: "read" });
    expect(row?.read_at).toBeTruthy();
  });

  it("marks a delivery failed and records the provider's error", async () => {
    const fake = makeFakeSupabase([BASE_DELIVERY]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyWhatsAppStatusUpdate(fake.client as any, {
      id: "wamid.abc123",
      status: "failed",
      timestamp: "1700000000",
      recipient_id: "15550001111",
      errors: [{ code: 131026, title: "Message undeliverable" }],
    });

    const row = fake.rows.get("delivery-1");
    expect(row).toMatchObject({ status: "failed", last_error: "Message undeliverable" });
  });

  it("is a no-op for a 'sent' status receipt (already our resting state)", async () => {
    const fake = makeFakeSupabase([BASE_DELIVERY]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyWhatsAppStatusUpdate(fake.client as any, { id: "wamid.abc123", status: "sent", timestamp: "1700000000", recipient_id: "x" });

    expect(fake.rows.get("delivery-1")).toMatchObject({ status: "sent" });
  });

  it("does nothing (never throws) when no delivery matches the provider_message_id", async () => {
    const fake = makeFakeSupabase([BASE_DELIVERY]);

    await expect(
      applyWhatsAppStatusUpdate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fake.client as any,
        { id: "wamid.unknown", status: "delivered", timestamp: "1700000000", recipient_id: "x" },
      ),
    ).resolves.toBeUndefined();
  });

  it("never throws on an invalid transition (e.g. a duplicate/out-of-order status redelivery)", async () => {
    const fake = makeFakeSupabase([{ ...BASE_DELIVERY, status: "read" }]);

    await expect(
      applyWhatsAppStatusUpdate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fake.client as any,
        { id: "wamid.abc123", status: "delivered", timestamp: "1700000000", recipient_id: "x" },
      ),
    ).resolves.toBeUndefined();
  });
});
