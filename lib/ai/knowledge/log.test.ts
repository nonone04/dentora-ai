import { beforeEach, describe, expect, it, vi } from "vitest";
import { recordKnowledgeSearch } from "@/lib/ai/knowledge/log";
import type { KnowledgeRecord, KnowledgeSearchResult } from "@/lib/ai/knowledge/types";

function makeFakeSupabase(insertResult: { error: unknown }) {
  const calls: Record<string, unknown>[] = [];
  return {
    calls,
    client: {
      from(table: string) {
        return {
          insert: (payload: Record<string, unknown>) => {
            calls.push({ table, payload });
            return Promise.resolve(insertResult);
          },
        };
      },
    },
  };
}

function makeRecord(id: string): KnowledgeRecord {
  return {
    id,
    clinicId: "clinic-1",
    category: "parking",
    title: "Parking",
    content: "Free parking.",
    keywords: ["parking"],
    isActive: true,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("recordKnowledgeSearch", () => {
  it("logs a hit with matched record ids and the top score", async () => {
    const fake = makeFakeSupabase({ error: null });
    const result: KnowledgeSearchResult = {
      query: "is there parking?",
      category: "parking",
      hit: true,
      matches: [
        { record: makeRecord("record-1"), score: 3 },
        { record: makeRecord("record-2"), score: 1 },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordKnowledgeSearch(fake.client as any, { clinicId: "clinic-1", conversationId: "conv-1", result, latencyMs: 42 });

    expect(fake.calls).toEqual([
      {
        table: "clinic_knowledge_searches",
        payload: {
          clinic_id: "clinic-1",
          conversation_id: "conv-1",
          query: "is there parking?",
          category: "parking",
          hit: true,
          matched_record_ids: ["record-1", "record-2"],
          top_score: 3,
          latency_ms: 42,
        },
      },
    ]);
  });

  it("logs a miss with an empty matched-ids array and a null top score", async () => {
    const fake = makeFakeSupabase({ error: null });
    const result: KnowledgeSearchResult = { query: "anything else?", category: null, hit: false, matches: [] };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await recordKnowledgeSearch(fake.client as any, { clinicId: "clinic-1", result, latencyMs: 10 });

    expect(fake.calls[0]).toMatchObject({
      payload: { hit: false, matched_record_ids: [], top_score: null, conversation_id: null },
    });
  });

  it("logs but does not throw when the insert fails", async () => {
    const fake = makeFakeSupabase({ error: { message: "boom" } });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result: KnowledgeSearchResult = { query: "x", category: null, hit: false, matches: [] };

    await expect(
      recordKnowledgeSearch(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fake.client as any,
        { clinicId: "clinic-1", result, latencyMs: 5 },
      ),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("failed to record knowledge search"), "boom");
  });
});
