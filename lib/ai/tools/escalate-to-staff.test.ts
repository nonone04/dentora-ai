import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const notifyEscalationMock = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@/lib/notifications", () => ({ notifyEscalation: notifyEscalationMock }));
vi.mock("@/lib/ai/permissions", () => ({ assertActionAllowed: vi.fn(() => Promise.resolve()) }));

let fakeSupabase: { from: (table: string) => unknown };
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => fakeSupabase }));

const { escalateToStaffTool, performEscalation } = await import("@/lib/ai/tools/escalate-to-staff");

function makeConversationsTable(rows: Row[]) {
  const b: Record<string, unknown> = {};
  const eqFilters: Record<string, unknown> = {};
  b.update = (payload: Row) => {
    for (const row of rows.filter((r) => Object.entries(eqFilters).every(([k, v]) => r[k] === v))) Object.assign(row, payload);
    return b;
  };
  b.eq = (col: string, val: unknown) => {
    eqFilters[col] = val;
    return b;
  };
  b.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(onFulfilled);
  return b;
}

beforeEach(() => {
  vi.restoreAllMocks();
  notifyEscalationMock.mockClear();
  notifyEscalationMock.mockResolvedValue(undefined);
});

describe("performEscalation", () => {
  it("marks the conversation escalated and routes the staff alert through the Notification & Communication Platform", async () => {
    const conversations: Row[] = [{ id: "conv-1", clinic_id: "clinic-1", status: "active" }];
    fakeSupabase = { from: (table: string) => (table === "ai_conversations" ? makeConversationsTable(conversations) : makeConversationsTable([])) };

    await performEscalation({ clinicId: "clinic-1", conversationId: "conv-1" }, "Upset patient");

    expect(conversations[0].status).toBe("escalated");
    expect(notifyEscalationMock).toHaveBeenCalledWith(fakeSupabase, { clinicId: "clinic-1", conversationId: "conv-1", reason: "Upset patient" });
  });

  it("never throws even when the notification hook fails", async () => {
    notifyEscalationMock.mockRejectedValue(new Error("boom"));
    const conversations: Row[] = [{ id: "conv-1", clinic_id: "clinic-1", status: "active" }];
    fakeSupabase = { from: () => makeConversationsTable(conversations) };

    await expect(performEscalation({ clinicId: "clinic-1", conversationId: "conv-1" }, "reason")).resolves.toBeUndefined();
  });

  it("still escalates the conversation with no conversationId given (no status update possible, no throw)", async () => {
    fakeSupabase = { from: () => makeConversationsTable([]) };
    await expect(performEscalation({ clinicId: "clinic-1" }, "reason")).resolves.toBeUndefined();
    expect(notifyEscalationMock).toHaveBeenCalledWith(fakeSupabase, { clinicId: "clinic-1", conversationId: null, reason: "reason" });
  });
});

describe("escalateToStaffTool", () => {
  it("escalates with a default reason when none is given", async () => {
    const conversations: Row[] = [{ id: "conv-1", clinic_id: "clinic-1", status: "active" }];
    fakeSupabase = { from: () => makeConversationsTable(conversations) };

    const result = await escalateToStaffTool.execute({}, { clinicId: "clinic-1", conversationId: "conv-1" });

    expect(result).toEqual({ escalated: true });
    expect(notifyEscalationMock).toHaveBeenCalledWith(fakeSupabase, { clinicId: "clinic-1", conversationId: "conv-1", reason: "No reason given." });
  });
});
