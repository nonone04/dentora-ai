import { describe, expect, it } from "vitest";
import { buildKnowledgeSection } from "@/lib/ai/knowledge/prompt";
import type { KnowledgeRecord, KnowledgeSearchResult } from "@/lib/ai/knowledge/types";

function makeRecord(overrides: Partial<KnowledgeRecord> = {}): KnowledgeRecord {
  return {
    id: "record-1",
    clinicId: "clinic-1",
    category: "parking",
    title: "Parking",
    content: "Free parking is available behind the clinic.",
    keywords: ["parking"],
    isActive: true,
    version: 1,
    createdBy: null,
    updatedBy: null,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
    ...overrides,
  };
}

describe("buildKnowledgeSection", () => {
  it("returns null when no search was attempted (the engine didn't run)", () => {
    expect(buildKnowledgeSection(null)).toBeNull();
  });

  it("lists matched records on a hit", () => {
    const result: KnowledgeSearchResult = {
      query: "is there parking?",
      category: null,
      hit: true,
      matches: [{ record: makeRecord(), score: 3 }],
    };

    const section = buildKnowledgeSection(result);
    expect(section).toContain("# Clinic knowledge");
    expect(section).toContain("Parking: Free parking is available behind the clinic.");
    expect(section).toContain("Answer using only the records below");
  });

  it("lists every matched record when there are several", () => {
    const result: KnowledgeSearchResult = {
      query: "hours and parking",
      category: null,
      hit: true,
      matches: [
        { record: makeRecord({ id: "a", title: "Parking" }), score: 2 },
        { record: makeRecord({ id: "b", title: "Opening hours", content: "Open 9am-6pm." }), score: 1 },
      ],
    };

    const section = buildKnowledgeSection(result);
    expect(section).toContain("Parking:");
    expect(section).toContain("Opening hours: Open 9am-6pm.");
  });

  it("states plainly that nothing matched on a miss, instead of omitting the section", () => {
    const result: KnowledgeSearchResult = { query: "do you have valet parking?", category: null, hit: false, matches: [] };

    const section = buildKnowledgeSection(result);
    expect(section).toContain("No documented knowledge matched");
    expect(section).toContain("do you have valet parking?");
    expect(section).toContain("don't have that information");
  });

  it("never invents content for a miss", () => {
    const result: KnowledgeSearchResult = { query: "anything", category: null, hit: false, matches: [] };
    const section = buildKnowledgeSection(result);
    expect(section).not.toContain("Free parking");
  });
});
