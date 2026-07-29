import { describe, expect, it } from "vitest";
import { isEmergency } from "@/lib/ai/decision/emergency";
import { EMPTY_ENTITIES, type NLUExtraction } from "@/lib/ai/nlu/types";

function makeNLU(overrides: Partial<NLUExtraction> = {}): NLUExtraction {
  return {
    intent: "other",
    entities: { ...EMPTY_ENTITIES },
    urgency: "low",
    language: "en",
    confidence: 0.5,
    missingFields: [],
    rawMessage: "hello",
    ...overrides,
  };
}

describe("isEmergency", () => {
  it("trusts the NLU extraction's own emergency classification", () => {
    expect(isEmergency(makeNLU({ urgency: "emergency", rawMessage: "just checking in" }))).toBe(true);
  });

  it("does not trust urgency alone when it's merely high", () => {
    expect(isEmergency(makeNLU({ urgency: "high", rawMessage: "I need an urgent appointment" }))).toBe(false);
  });

  it("independently detects an emergency phrase even when urgency was under-classified", () => {
    // Defense-in-depth: the extraction (e.g. a lower-confidence Anthropic
    // call) said "high", but the raw text is unambiguous -- the Decision
    // Engine shouldn't rely on urgency alone.
    expect(isEmergency(makeNLU({ urgency: "high", rawMessage: "My tooth got knocked out and I can't stop bleeding" }))).toBe(
      true,
    );
  });

  it("detects each documented emergency phrase", () => {
    const phrases = [
      "This is an emergency",
      "C'est une urgence",
      "I can't stop bleeding",
      "I cannot stop bleeding",
      "Ça ne s'arrête pas de saigner",
      "My tooth was knocked out",
      "My face is swelling up",
      "Mon visage est enflé",
      "I'm in severe pain",
      "The pain is unbearable",
      "Douleur insupportable",
      "I can't breathe properly",
      "I'm having trouble breathing",
    ];

    for (const rawMessage of phrases) {
      expect(isEmergency(makeNLU({ rawMessage }))).toBe(true);
    }
  });

  it("does not flag an unrelated message as an emergency", () => {
    expect(isEmergency(makeNLU({ rawMessage: "What are your opening hours?" }))).toBe(false);
    expect(isEmergency(makeNLU({ rawMessage: "I'd like to book a cleaning for tomorrow" }))).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isEmergency(makeNLU({ rawMessage: "EMERGENCY, please help" }))).toBe(true);
  });
});
