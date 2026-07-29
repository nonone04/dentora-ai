import { describe, expect, it } from "vitest";
import { EMPTY_ENTITIES } from "@/lib/ai/nlu/types";
import {
  clampConfidence,
  computeMissingFields,
  isNLUIntent,
  isNLULanguage,
  isNLUUrgency,
  normalizeEntities,
  parseNLUExtraction,
} from "@/lib/ai/nlu/validate";

describe("clampConfidence", () => {
  it("passes through in-range numbers", () => {
    expect(clampConfidence(0.42)).toBe(0.42);
  });

  it("clamps above 1 down to 1", () => {
    expect(clampConfidence(5)).toBe(1);
  });

  it("clamps below 0 up to 0", () => {
    expect(clampConfidence(-3)).toBe(0);
  });

  it("falls back to 0 for non-numeric input", () => {
    expect(clampConfidence("not a number")).toBe(0);
    expect(clampConfidence(null)).toBe(0);
    expect(clampConfidence(undefined)).toBe(0);
    expect(clampConfidence(Number.NaN)).toBe(0);
  });
});

describe("isNLUIntent / isNLUUrgency / isNLULanguage", () => {
  it("accepts known values", () => {
    expect(isNLUIntent("book_appointment")).toBe(true);
    expect(isNLUUrgency("emergency")).toBe(true);
    expect(isNLULanguage("ar")).toBe(true);
    expect(isNLULanguage("other")).toBe(true);
  });

  it("rejects unknown or wrongly-typed values", () => {
    expect(isNLUIntent("delete_everything")).toBe(false);
    expect(isNLUIntent(42)).toBe(false);
    expect(isNLUUrgency("critical")).toBe(false);
    expect(isNLULanguage("es")).toBe(false);
  });
});

describe("normalizeEntities", () => {
  it("coerces a well-formed payload", () => {
    expect(normalizeEntities({ date: "2026-08-01", time: "14:00", service: null })).toEqual({
      ...EMPTY_ENTITIES,
      date: "2026-08-01",
      time: "14:00",
    });
  });

  it("treats non-string fields, empty strings, and whitespace as null rather than throwing", () => {
    expect(
      normalizeEntities({
        date: 123,
        time: "   ",
        service: "",
        dentist: ["Dr", "Amrani"],
        patientName: { first: "Amina" },
        phone: "  0612345678  ",
      }),
    ).toEqual({
      ...EMPTY_ENTITIES,
      phone: "0612345678",
    });
  });

  it("returns all-null entities for a non-object payload", () => {
    expect(normalizeEntities(null)).toEqual(EMPTY_ENTITIES);
    expect(normalizeEntities("garbage")).toEqual(EMPTY_ENTITIES);
    expect(normalizeEntities(undefined)).toEqual(EMPTY_ENTITIES);
  });
});

describe("computeMissingFields", () => {
  it("requires service + date for book_appointment when absent", () => {
    expect(computeMissingFields("book_appointment", EMPTY_ENTITIES)).toEqual(
      expect.arrayContaining(["service", "date", "patientName"]),
    );
  });

  it("drops a field from the missing list once it's present", () => {
    const missing = computeMissingFields("book_appointment", {
      ...EMPTY_ENTITIES,
      service: "cleaning",
      date: "2026-08-01",
    });
    expect(missing).toEqual(["patientName"]);
  });

  it("does not require patientName when the patient is already known from conversation context", () => {
    const missing = computeMissingFields(
      "book_appointment",
      { ...EMPTY_ENTITIES, service: "cleaning", date: "2026-08-01" },
      { patientKnown: true },
    );
    expect(missing).toEqual([]);
  });

  it("does not require patientName when a phone number was already given", () => {
    const missing = computeMissingFields("book_appointment", {
      ...EMPTY_ENTITIES,
      service: "cleaning",
      date: "2026-08-01",
      phone: "0612345678",
    });
    expect(missing).toEqual([]);
  });

  it("has no required fields for info-only intents", () => {
    expect(computeMissingFields("ask_faq", EMPTY_ENTITIES)).toEqual([]);
    expect(computeMissingFields("get_clinic_info", EMPTY_ENTITIES)).toEqual([]);
    expect(computeMissingFields("escalate_to_staff", EMPTY_ENTITIES)).toEqual([]);
    expect(computeMissingFields("greeting", EMPTY_ENTITIES)).toEqual([]);
    expect(computeMissingFields("other", EMPTY_ENTITIES)).toEqual([]);
  });

  it("requires only date for check_availability, no patient identification", () => {
    expect(computeMissingFields("check_availability", EMPTY_ENTITIES)).toEqual(["date"]);
  });

  it("does not double up patientName as required when already extracted", () => {
    const missing = computeMissingFields("cancel_appointment", {
      ...EMPTY_ENTITIES,
      date: "2026-08-01",
      patientName: "Amina Amrani",
    });
    expect(missing).toEqual([]);
  });
});

describe("parseNLUExtraction", () => {
  it("parses a well-formed raw payload", () => {
    const result = parseNLUExtraction(
      {
        intent: "book_appointment",
        entities: { date: "2026-08-01", time: "14:00", service: "cleaning", dentist: null, patientName: null, phone: null },
        urgency: "low",
        language: "fr",
        confidence: 0.8,
      },
      "Je voudrais un rendez-vous",
    );

    expect(result.intent).toBe("book_appointment");
    expect(result.entities.date).toBe("2026-08-01");
    expect(result.urgency).toBe("low");
    expect(result.language).toBe("fr");
    expect(result.confidence).toBe(0.8);
    expect(result.rawMessage).toBe("Je voudrais un rendez-vous");
    // service+date present, but no patient identification -> patientName still missing.
    expect(result.missingFields).toEqual(["patientName"]);
  });

  it("falls back to safe defaults for a garbage payload instead of throwing", () => {
    const result = parseNLUExtraction("not an object at all", "hello");
    expect(result.intent).toBe("other");
    expect(result.urgency).toBe("low");
    expect(result.language).toBe("other");
    expect(result.confidence).toBe(0);
    expect(result.entities).toEqual(EMPTY_ENTITIES);
    expect(result.missingFields).toEqual([]);
  });

  it("never trusts an upstream missingFields value -- always recomputes it", () => {
    const result = parseNLUExtraction(
      {
        intent: "book_appointment",
        entities: { date: "2026-08-01", time: null, service: "cleaning", dentist: null, patientName: "Amina", phone: null },
        urgency: "low",
        language: "en",
        confidence: 0.9,
        missingFields: ["date", "time", "service", "dentist", "patientName", "phone"],
      },
      "book me a cleaning on 2026-08-01, I'm Amina",
    );

    expect(result.missingFields).toEqual([]);
  });

  it("clamps an out-of-range confidence from the raw payload", () => {
    const result = parseNLUExtraction({ intent: "greeting", confidence: 3.5 }, "hi");
    expect(result.confidence).toBe(1);
  });
});
