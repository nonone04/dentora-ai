import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchConversationTraceRawData } from "@/lib/observability/trace/query";

type Row = Record<string, unknown>;

function makeListBuilder(result: { data: Row[] | null; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order"]) b[method] = () => b;
  b.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) => Promise.resolve(result).then(onFulfilled, onRejected);
  return b;
}

function makeSingleBuilder(result: { data: Row | null; error: unknown }) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "eq"]) b[method] = () => b;
  b.maybeSingle = () => Promise.resolve(result);
  return b;
}

const CONVERSATION: Row = { id: "conv-1", clinic_id: "clinic-1", channel: "whatsapp", status: "resolved", started_at: "2026-07-27T09:00:00.000Z", ended_at: null };

function makeFakeSupabase(overrides: Partial<Record<string, unknown>> = {}) {
  const tables: Record<string, unknown> = {
    ai_conversations: makeSingleBuilder({ data: CONVERSATION, error: null }),
    ai_messages: makeListBuilder({ data: [{ role: "user", content: "hi", ai_action: null, created_at: "2026-07-27T09:00:01.000Z" }], error: null }),
    ai_nlu_extractions: makeListBuilder({ data: [], error: null }),
    ai_decisions: makeListBuilder({ data: [], error: null }),
    ai_availability_queries: makeListBuilder({ data: [], error: null }),
    clinic_knowledge_searches: makeListBuilder({ data: [], error: null }),
    appointment_lifecycle_events: makeListBuilder({ data: [], error: null }),
    notification_events: makeListBuilder({ data: [], error: null }),
    ai_turn_events: makeListBuilder({ data: [], error: null }),
    ...overrides,
  };
  return { from: (table: string) => tables[table] ?? makeListBuilder({ data: [], error: null }) };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchConversationTraceRawData", () => {
  it("fetches the conversation and every engine's rows for it", async () => {
    const supabase = makeFakeSupabase();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchConversationTraceRawData(supabase as any, { clinicId: "clinic-1", conversationId: "conv-1" });

    expect(raw.conversation).toMatchObject({ id: "conv-1", channel: "whatsapp", status: "resolved" });
    expect(raw.messages).toHaveLength(1);
  });

  it("returns conversation: null when it doesn't exist for this clinic", async () => {
    const supabase = makeFakeSupabase({ ai_conversations: makeSingleBuilder({ data: null, error: null }) });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchConversationTraceRawData(supabase as any, { clinicId: "clinic-1", conversationId: "missing" });
    expect(raw.conversation).toBeNull();
  });

  it("degrades a failing secondary source to an empty array rather than throwing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rejecting: Record<string, unknown> = {};
    for (const method of ["select", "eq", "order"]) rejecting[method] = () => rejecting;
    rejecting.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.reject(new Error("boom")).then(onFulfilled, onRejected);

    const supabase = makeFakeSupabase({ ai_decisions: rejecting });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = await fetchConversationTraceRawData(supabase as any, { clinicId: "clinic-1", conversationId: "conv-1" });
    expect(raw.decisions).toEqual([]);
    expect(raw.conversation).not.toBeNull(); // unaffected
  });
});
