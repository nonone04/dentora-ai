import { describe, expect, it } from "vitest";
import { isKnowledgeCategory, parseKnowledgeRecordRow, parseKnowledgeRecordVersionRow, type KnowledgeRecordRow, type KnowledgeRecordVersionRow } from "@/lib/ai/knowledge/validate";

function makeRow(overrides: Partial<KnowledgeRecordRow> = {}): KnowledgeRecordRow {
  return {
    id: "record-1",
    clinic_id: "clinic-1",
    category: "parking",
    title: "Parking",
    content: "Free parking behind the clinic.",
    keywords: ["parking", "park"],
    is_active: true,
    version: 2,
    created_by: "user-1",
    updated_by: "user-2",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-05T00:00:00.000Z",
    ...overrides,
  };
}

describe("isKnowledgeCategory", () => {
  it("accepts every known category", () => {
    for (const category of ["services", "pricing", "hours", "insurance", "payment_methods", "parking", "cancellation_policy", "faq", "emergency"]) {
      expect(isKnowledgeCategory(category)).toBe(true);
    }
  });

  it("rejects unknown values", () => {
    expect(isKnowledgeCategory("weather")).toBe(false);
    expect(isKnowledgeCategory(42)).toBe(false);
    expect(isKnowledgeCategory(null)).toBe(false);
  });
});

describe("parseKnowledgeRecordRow", () => {
  it("parses a well-formed row", () => {
    const record = parseKnowledgeRecordRow(makeRow());

    expect(record).toEqual({
      id: "record-1",
      clinicId: "clinic-1",
      category: "parking",
      title: "Parking",
      content: "Free parking behind the clinic.",
      keywords: ["parking", "park"],
      isActive: true,
      version: 2,
      createdBy: "user-1",
      updatedBy: "user-2",
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-05T00:00:00.000Z",
    });
  });

  it("falls back to safe defaults for every malformed field instead of throwing", () => {
    const record = parseKnowledgeRecordRow(
      makeRow({
        id: 42,
        clinic_id: null,
        category: "not-a-category",
        title: 123,
        content: null,
        keywords: "not-an-array",
        is_active: "yes",
        version: "two",
        created_by: 5,
        created_at: 0,
      }),
    );

    expect(record.id).toBe("");
    expect(record.clinicId).toBe("");
    expect(record.category).toBe("faq");
    expect(record.title).toBe("");
    expect(record.content).toBe("");
    expect(record.keywords).toEqual([]);
    expect(record.isActive).toBe(true);
    expect(record.version).toBe(0);
    expect(record.createdBy).toBeNull();
    expect(record.createdAt).toBe(new Date(0).toISOString());
  });

  it("filters out non-string entries from a malformed keywords array", () => {
    const record = parseKnowledgeRecordRow(makeRow({ keywords: ["parking", 42, null, "garage"] as unknown as string[] }));
    expect(record.keywords).toEqual(["parking", "garage"]);
  });
});

describe("parseKnowledgeRecordVersionRow", () => {
  function makeVersionRow(overrides: Partial<KnowledgeRecordVersionRow> = {}): KnowledgeRecordVersionRow {
    return {
      record_id: "record-1",
      clinic_id: "clinic-1",
      version: 1,
      category: "faq",
      title: "Old title",
      content: "Old content",
      keywords: ["old"],
      is_active: true,
      changed_by: "user-1",
      change_reason: "created",
      created_at: "2026-07-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("parses a well-formed version row", () => {
    const version = parseKnowledgeRecordVersionRow(makeVersionRow());
    expect(version).toEqual({
      recordId: "record-1",
      clinicId: "clinic-1",
      version: 1,
      category: "faq",
      title: "Old title",
      content: "Old content",
      keywords: ["old"],
      isActive: true,
      changedBy: "user-1",
      changeReason: "created",
      createdAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("falls back to safe defaults for malformed fields", () => {
    const version = parseKnowledgeRecordVersionRow(makeVersionRow({ version: "one", category: "bogus", changed_by: 1, change_reason: null }));
    expect(version.version).toBe(0);
    expect(version.category).toBe("faq");
    expect(version.changedBy).toBeNull();
    expect(version.changeReason).toBeNull();
  });
});
