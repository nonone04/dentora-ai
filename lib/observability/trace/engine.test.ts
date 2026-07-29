import { beforeEach, describe, expect, it, vi } from "vitest";
import { getConversationTrace } from "@/lib/observability/trace/engine";

type Row = Record<string, unknown>;

function makeListBuilder(rows: Row[]) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(onFulfilled);
  return b;
}

function makeSingleBuilder(row: Row | null) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) b[method] = () => b;
  b.maybeSingle = () => Promise.resolve({ data: row, error: null });
  return b;
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("getConversationTrace", () => {
  it("returns null when the conversation doesn't exist", async () => {
    const client = {
      from: (table: string) => (table === "ai_conversations" ? makeSingleBuilder(null) : makeListBuilder([])),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trace = await getConversationTrace(client as any, { clinicId: "clinic-1", conversationId: "missing" });
    expect(trace).toBeNull();
  });

  it("returns a fully assembled, chronologically-ordered trace", async () => {
    const conversation = { id: "conv-1", clinic_id: "clinic-1", channel: "web_chat", status: "resolved", started_at: "2026-07-27T09:00:00.000Z", ended_at: "2026-07-27T09:05:00.000Z" };

    const client = {
      from: (table: string) => {
        if (table === "ai_conversations") return makeSingleBuilder(conversation);
        if (table === "ai_messages")
          return makeListBuilder([
            { role: "user", content: "Can I book a cleaning tomorrow?", ai_action: null, created_at: "2026-07-27T09:00:01.000Z" },
            { role: "assistant", content: "Booked!", ai_action: "draft_appointment", created_at: "2026-07-27T09:00:05.000Z" },
          ]);
        if (table === "ai_nlu_extractions")
          return makeListBuilder([
            { intent: "book_appointment", urgency: "low", language: "en", confidence: 0.9, missing_fields: [], latency_ms: 50, created_at: "2026-07-27T09:00:02.000Z" },
          ]);
        if (table === "ai_decisions")
          return makeListBuilder([
            { decision_kind: "execute_tool", reason: "clear booking request", intent: "book_appointment", urgency: "low", confidence: 0.9, latency_ms: 30, created_at: "2026-07-27T09:00:03.000Z" },
          ]);
        return makeListBuilder([]);
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trace = await getConversationTrace(client as any, { clinicId: "clinic-1", conversationId: "conv-1" });

    expect(trace).toMatchObject({ conversationId: "conv-1", clinicId: "clinic-1", channel: "web_chat", status: "resolved" });
    expect(trace!.steps.map((s) => s.type)).toEqual(["message", "nlu_extraction", "decision", "tool_call"]);
  });
});
