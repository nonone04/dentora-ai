import { describe, expect, it } from "vitest";
import { scoreRecord, searchKnowledge } from "@/lib/ai/knowledge/match";
import type { KnowledgeRecord } from "@/lib/ai/knowledge/types";

function makeRecord(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "record-1",
    clinicId: "clinic-1",
    category: "faq",
    title: "Parking",
    content: "Free parking is available behind the clinic.",
    keywords: ["parking", "park"],
    isActive: true,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("scoreRecord", () => {
  it("scores a verbatim keyword phrase match highly", () => {
    const record = makeRecord({ keywords: ["cancellation policy"] });
    expect(scoreRecord(record, "What is your cancellation policy?")).toBeGreaterThanOrEqual(2);
  });

  it("scores a keyword phrase match higher than a bare title-word overlap", () => {
    const withKeyword = scoreRecord(makeRecord({ title: "Parking", keywords: ["parking"] }), "Tell me about parking");
    const titleOnly = scoreRecord(makeRecord({ title: "Parking", keywords: [] }), "Tell me about parking");
    expect(withKeyword).toBeGreaterThan(titleOnly);
  });

  it("scores zero for a completely unrelated query", () => {
    const record = makeRecord({ title: "Parking", keywords: ["parking", "park"] });
    expect(scoreRecord(record, "Do you accept insurance?")).toBe(0);
  });

  it("is case-insensitive", () => {
    const record = makeRecord({ keywords: ["Parking"] });
    expect(scoreRecord(record, "PARKING INFO")).toBeGreaterThan(0);
  });

  it("adds up multiple matching keywords", () => {
    const record = makeRecord({ keywords: ["parking", "garage"] });
    const oneMatch = scoreRecord(record, "Do you have parking?");
    const twoMatches = scoreRecord(record, "Do you have parking or a garage?");
    expect(twoMatches).toBeGreaterThan(oneMatch);
  });
});

describe("searchKnowledge: retrieval accuracy", () => {
  const records: KnowledgeRecord[] = [
    makeRecord({ id: "parking", category: "parking", title: "Parking", keywords: ["parking", "park", "garage"], content: "Free parking behind the clinic." }),
    makeRecord({ id: "insurance", category: "insurance", title: "Insurance", keywords: ["insurance", "coverage"], content: "We accept most major insurance providers." }),
    makeRecord({ id: "cancellation", category: "cancellation_policy", title: "Cancellation policy", keywords: ["cancellation policy", "cancel", "reschedule fee"], content: "Cancel at least 24 hours in advance to avoid a fee." }),
    makeRecord({ id: "hours", category: "hours", title: "Opening hours", keywords: ["opening hours", "hours", "open"], content: "We're open Monday to Saturday, 9am-6pm." }),
  ];

  it("returns the single relevant record for a clear query", () => {
    const result = searchKnowledge(records, "Is there parking available?");
    expect(result.hit).toBe(true);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].record.id).toBe("parking");
  });

  it("ranks the most relevant record first when multiple could apply", () => {
    const result = searchKnowledge(records, "What's your cancellation policy if I need to reschedule?");
    expect(result.matches[0].record.id).toBe("cancellation");
  });

  it("reports a miss for a query matching nothing", () => {
    const result = searchKnowledge(records, "Do you have a dog-friendly waiting room?");
    expect(result.hit).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it("filters to the given category even if another category would score higher", () => {
    const result = searchKnowledge(records, "insurance and parking", { category: "parking" });
    expect(result.matches.every((match) => match.record.category === "parking")).toBe(true);
  });

  it("returns a miss when the category filter excludes every match", () => {
    const result = searchKnowledge(records, "parking", { category: "insurance" });
    expect(result.hit).toBe(false);
  });

  it("respects a custom limit", () => {
    const manyMatches = [
      makeRecord({ id: "a", title: "Parking A", keywords: ["parking"] }),
      makeRecord({ id: "b", title: "Parking B", keywords: ["parking"] }),
      makeRecord({ id: "c", title: "Parking C", keywords: ["parking"] }),
    ];
    const result = searchKnowledge(manyMatches, "parking", { limit: 2 });
    expect(result.matches).toHaveLength(2);
  });

  it("defaults to a limit of 3", () => {
    const manyMatches = Array.from({ length: 5 }, (_, i) => makeRecord({ id: `r${i}`, title: `Parking ${i}`, keywords: ["parking"] }));
    const result = searchKnowledge(manyMatches, "parking");
    expect(result.matches.length).toBeLessThanOrEqual(3);
  });

  it("breaks a score tie deterministically by title", () => {
    const tied = [
      makeRecord({ id: "z", title: "Zebra parking", keywords: ["parking"] }),
      makeRecord({ id: "a", title: "Alpha parking", keywords: ["parking"] }),
    ];
    const result = searchKnowledge(tied, "parking");
    expect(result.matches[0].record.id).toBe("a");
  });

  it("preserves the query and category on the result even on a miss", () => {
    const result = searchKnowledge(records, "xyz", { category: "faq" });
    expect(result.query).toBe("xyz");
    expect(result.category).toBe("faq");
  });

  it("returns an empty result for an empty record list", () => {
    const result = searchKnowledge([], "parking");
    expect(result.hit).toBe(false);
    expect(result.matches).toEqual([]);
  });
});
