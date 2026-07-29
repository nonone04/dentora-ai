import { describe, expect, it } from "vitest";
import { countUnreadNotifications, listNotificationCenterItems } from "@/lib/notifications/queries";

type Row = Record<string, unknown>;

/** Minimal read-only fake supporting exactly the chain shapes queries.ts uses: eq/is/in/order/limit, plus a count-mode select for countUnreadNotifications. */
function makeQueryClient(rows: Row[]) {
  return {
    from: (_table: string) => {
      const eqFilters: Record<string, unknown> = {};
      const isFilters: Record<string, unknown> = {};
      let inFilter: { column: string; values: unknown[] } | null = null;
      let countMode = false;

      const b = {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.count) countMode = true;
          return b;
        },
        eq(column: string, value: unknown) {
          eqFilters[column] = value;
          return b;
        },
        is(column: string, value: unknown) {
          isFilters[column] = value;
          return b;
        },
        in(column: string, values: unknown[]) {
          inFilter = { column, values };
          return b;
        },
        order() {
          return b;
        },
        limit() {
          return b;
        },
        then(onFulfilled: (v: { data: unknown; error: unknown; count?: number }) => unknown, onRejected?: (r: unknown) => unknown) {
          const matched = rows.filter((row) => {
            if (!Object.entries(eqFilters).every(([k, v]) => row[k] === v)) return false;
            if (!Object.entries(isFilters).every(([k, v]) => row[k] === v)) return false;
            if (inFilter && !inFilter.values.includes(row[inFilter.column])) return false;
            return true;
          });
          const result = countMode ? { data: null, error: null, count: matched.length } : { data: matched, error: null };
          return Promise.resolve(result).then(onFulfilled, onRejected);
        },
      };
      return b;
    },
  };
}

const ROWS: Row[] = [
  { id: "d1", clinic_id: "clinic-1", status: "sent", channel: "in_app", created_at: "2026-07-29T10:00:00Z", archived_at: null, notification_events: { type: "conversation_escalated" } },
  { id: "d2", clinic_id: "clinic-1", status: "read", channel: "in_app", created_at: "2026-07-29T09:00:00Z", archived_at: null, notification_events: { type: "appointment_booked" } },
  { id: "d3", clinic_id: "clinic-1", status: "delivered", channel: "in_app", created_at: "2026-07-29T08:00:00Z", archived_at: "2026-07-29T11:00:00Z", notification_events: { type: "appointment_booked" } },
  { id: "d4", clinic_id: "clinic-1", status: "sent", channel: "email", created_at: "2026-07-29T07:00:00Z", archived_at: null, notification_events: { type: "appointment_confirmed" } },
  { id: "d5", clinic_id: "clinic-2", status: "sent", channel: "in_app", created_at: "2026-07-29T06:00:00Z", archived_at: null, notification_events: { type: "conversation_escalated" } },
];

describe("listNotificationCenterItems", () => {
  it("excludes archived rows by default and derives category from the joined event type", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await listNotificationCenterItems(makeQueryClient(ROWS) as any, { clinicId: "clinic-1" });
    expect(items?.map((i) => i.id).sort()).toEqual(["d1", "d2", "d4"]);
    expect(items?.find((i) => i.id === "d1")?.category).toBe("ai");
    expect(items?.find((i) => i.id === "d2")?.category).toBe("appointments");
  });

  it("includes archived rows when explicitly requested", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await listNotificationCenterItems(makeQueryClient(ROWS) as any, { clinicId: "clinic-1", includeArchived: true });
    expect(items?.map((i) => i.id).sort()).toEqual(["d1", "d2", "d3", "d4"]);
  });

  it("filters by channel", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await listNotificationCenterItems(makeQueryClient(ROWS) as any, { clinicId: "clinic-1", channel: "in_app" });
    expect(items?.map((i) => i.id).sort()).toEqual(["d1", "d2"]);
  });

  it("filters by category", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await listNotificationCenterItems(makeQueryClient(ROWS) as any, { clinicId: "clinic-1", category: "ai" });
    expect(items?.map((i) => i.id)).toEqual(["d1"]);
  });

  it("never returns another clinic's rows", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = await listNotificationCenterItems(makeQueryClient(ROWS) as any, { clinicId: "clinic-1", includeArchived: true });
    expect(items?.some((i) => i.id === "d5")).toBe(false);
  });
});

describe("countUnreadNotifications", () => {
  it("counts only unread (sent/delivered), unarchived, in_app deliveries for the clinic", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const count = await countUnreadNotifications(makeQueryClient(ROWS) as any, "clinic-1");
    // d1 (sent, in_app, unarchived) qualifies; d2 is "read" (excluded); d3 is archived (excluded); d4 is email (excluded).
    expect(count).toBe(1);
  });
});
