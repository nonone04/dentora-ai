import { describe, expect, it } from "vitest";
import {
  buildTemplateCsv,
  validateDentistRow,
  validatePatientRow,
  validateServiceRow,
} from "@/lib/import/schemas";
import { parseCsv } from "@/lib/import/csv";

describe("validatePatientRow", () => {
  it("accepts a minimal valid row and defaults preferredLanguage to fr", () => {
    const result = validatePatientRow({ fullName: "Sara Amrani" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.fullName).toBe("Sara Amrani");
      expect(result.value.preferredLanguage).toBe("fr");
      expect(result.value.phone).toBeNull();
    }
  });

  it("rejects a missing fullName", () => {
    const result = validatePatientRow({ fullName: "  " });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([{ field: "fullName", code: "required" }]);
  });

  it("rejects an invalid preferredLanguage", () => {
    const result = validatePatientRow({ fullName: "Sara", preferredLanguage: "es" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([{ field: "preferredLanguage", code: "invalid_language" }]);
  });

  it("trims and nulls out blank optional fields", () => {
    const result = validatePatientRow({ fullName: "Sara", phone: "  ", notes: "" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.phone).toBeNull();
      expect(result.value.notes).toBeNull();
    }
  });
});

describe("validateDentistRow", () => {
  it("accepts a minimal valid row", () => {
    const result = validateDentistRow({ fullName: "Dr. Youssef Benali" });
    expect(result.ok).toBe(true);
  });

  it("rejects a missing fullName", () => {
    const result = validateDentistRow({ fullName: "" });
    expect(result.ok).toBe(false);
  });
});

describe("validateServiceRow", () => {
  it("accepts a valid row and defaults currency to MAD", () => {
    const result = validateServiceRow({ name: "Cleaning", defaultDurationMinutes: "30" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.defaultDurationMinutes).toBe(30);
      expect(result.value.currency).toBe("MAD");
      expect(result.value.price).toBeNull();
    }
  });

  it("rejects a non-positive duration", () => {
    const result = validateServiceRow({ name: "Cleaning", defaultDurationMinutes: "0" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([{ field: "defaultDurationMinutes", code: "invalid_duration" }]);
  });

  it("rejects a negative price", () => {
    const result = validateServiceRow({ name: "Cleaning", defaultDurationMinutes: "30", price: "-5" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toEqual([{ field: "price", code: "invalid_price" }]);
  });

  it("collects multiple field errors at once", () => {
    const result = validateServiceRow({ name: "", defaultDurationMinutes: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([
        { field: "name", code: "required" },
        { field: "defaultDurationMinutes", code: "invalid_duration" },
      ]);
    }
  });
});

describe("buildTemplateCsv", () => {
  it("produces a parseable header + example row for every entity", () => {
    for (const entity of ["patients", "dentists", "services"] as const) {
      const table = parseCsv(buildTemplateCsv(entity));
      expect(table.length).toBe(2);
      expect(table[0].length).toBe(table[1].length);
    }
  });
});
