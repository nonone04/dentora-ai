import { describe, expect, it } from "vitest";
import { CONFIDENCE_THRESHOLDS } from "@/lib/ai/decision/thresholds";
import { decide } from "@/lib/ai/decision/router";
import { buildEmergencyReply, buildEscalationReply, buildGreetingReply } from "@/lib/ai/decision/replies";
import { buildFollowUpQuestion } from "@/lib/ai/nlu/follow-up";
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

describe("decide: emergency_workflow", () => {
  it("wins regardless of confidence", () => {
    const decision = decide(makeNLU({ urgency: "emergency", confidence: 0.01, rawMessage: "help, emergency" }));
    expect(decision.kind).toBe("emergency_workflow");
  });

  it("returns the language-appropriate emergency reply", () => {
    const decision = decide(makeNLU({ urgency: "emergency", language: "fr", rawMessage: "urgence" }));
    expect(decision.kind).toBe("emergency_workflow");
    if (decision.kind === "emergency_workflow") {
      expect(decision.reply).toBe(buildEmergencyReply({ language: "fr" }));
    }
  });

  it("takes precedence over an explicit escalation intent", () => {
    const decision = decide(
      makeNLU({ intent: "escalate_to_staff", confidence: 0.9, urgency: "emergency", rawMessage: "emergency, get me a human" }),
    );
    expect(decision.kind).toBe("emergency_workflow");
  });

  it("takes precedence over a bare greeting", () => {
    const decision = decide(makeNLU({ intent: "greeting", confidence: 0.9, rawMessage: "help, I can't stop bleeding" }));
    expect(decision.kind).toBe("emergency_workflow");
  });

  it("takes precedence over missing required fields for booking", () => {
    const decision = decide(
      makeNLU({ intent: "book_appointment", confidence: 0.9, rawMessage: "emergency, my tooth was knocked out" }),
    );
    expect(decision.kind).toBe("emergency_workflow");
  });
});

describe("decide: escalate_to_staff", () => {
  it("fires at or above the escalation threshold", () => {
    const decision = decide(
      makeNLU({ intent: "escalate_to_staff", confidence: CONFIDENCE_THRESHOLDS.escalation, rawMessage: "get me a human" }),
    );
    expect(decision.kind).toBe("escalate_to_staff");
  });

  it("does not fire just below the escalation threshold -- falls through to execute_tool", () => {
    const decision = decide(
      makeNLU({
        intent: "escalate_to_staff",
        confidence: CONFIDENCE_THRESHOLDS.escalation - 0.01,
        rawMessage: "get me a human",
      }),
    );
    expect(decision.kind).toBe("execute_tool");
  });

  it("returns the language-appropriate escalation acknowledgment", () => {
    const decision = decide(makeNLU({ intent: "escalate_to_staff", confidence: 0.9, language: "ar" }));
    expect(decision.kind).toBe("escalate_to_staff");
    if (decision.kind === "escalate_to_staff") {
      expect(decision.reply).toBe(buildEscalationReply({ language: "ar" }));
    }
  });

  it("only fires for the escalate_to_staff intent", () => {
    const decision = decide(makeNLU({ intent: "ask_faq", confidence: 0.95 }));
    expect(decision.kind).not.toBe("escalate_to_staff");
  });
});

describe("decide: reply_directly (greeting)", () => {
  it("fires at or above the greeting threshold", () => {
    const decision = decide(makeNLU({ intent: "greeting", confidence: CONFIDENCE_THRESHOLDS.greeting, rawMessage: "hi" }));
    expect(decision.kind).toBe("reply_directly");
  });

  it("does not fire just below the greeting threshold -- falls through to execute_tool", () => {
    const decision = decide(
      makeNLU({ intent: "greeting", confidence: CONFIDENCE_THRESHOLDS.greeting - 0.01, rawMessage: "hi" }),
    );
    expect(decision.kind).toBe("execute_tool");
  });

  it("returns the language-appropriate greeting", () => {
    const decision = decide(makeNLU({ intent: "greeting", confidence: 0.9, language: "fr" }));
    expect(decision.kind).toBe("reply_directly");
    if (decision.kind === "reply_directly") {
      expect(decision.reply).toBe(buildGreetingReply({ language: "fr" }));
    }
  });

  it("only fires for the greeting intent", () => {
    const decision = decide(makeNLU({ intent: "ask_faq", confidence: 0.95 }));
    expect(decision.kind).not.toBe("reply_directly");
  });
});

describe("decide: ask_follow_up", () => {
  it("fires when required fields are missing and confidence clears the follow-up threshold", () => {
    const decision = decide(makeNLU({ intent: "book_appointment", confidence: CONFIDENCE_THRESHOLDS.followUp }));
    expect(decision.kind).toBe("ask_follow_up");
    if (decision.kind === "ask_follow_up") {
      expect(decision.missingFields).toEqual(expect.arrayContaining(["service", "date", "patientName"]));
      expect(decision.reply).toBe(
        buildFollowUpQuestion(decision.missingFields, { language: "en", clinicDefaultLanguage: undefined }),
      );
    }
  });

  it("does not fire just below the follow-up threshold -- falls through to execute_tool", () => {
    const decision = decide(
      makeNLU({ intent: "book_appointment", confidence: CONFIDENCE_THRESHOLDS.followUp - 0.01 }),
    );
    expect(decision.kind).toBe("execute_tool");
  });

  it("does not fire once all required fields are present", () => {
    const decision = decide(
      makeNLU({
        intent: "book_appointment",
        confidence: 0.9,
        entities: { ...EMPTY_ENTITIES, service: "cleaning", date: "2026-08-05" },
      }),
      { patientKnown: true },
    );
    expect(decision.kind).toBe("execute_tool");
  });

  it("respects patientKnown context from the caller", () => {
    const entities = { ...EMPTY_ENTITIES, service: "cleaning", date: "2026-08-05" };

    const unknownPatient = decide(makeNLU({ intent: "book_appointment", confidence: 0.9, entities }));
    expect(unknownPatient.kind).toBe("ask_follow_up");
    if (unknownPatient.kind === "ask_follow_up") {
      expect(unknownPatient.missingFields).toEqual(["patientName"]);
    }

    const knownPatient = decide(makeNLU({ intent: "book_appointment", confidence: 0.9, entities }), { patientKnown: true });
    expect(knownPatient.kind).toBe("execute_tool");
  });

  it("has no required fields for info-only intents, so it never fires for them", () => {
    for (const intent of ["ask_faq", "get_clinic_info", "other"] as const) {
      const decision = decide(makeNLU({ intent, confidence: 0.9 }));
      expect(decision.kind).toBe("execute_tool");
    }
  });
});

describe("decide: execute_tool (default)", () => {
  it("is the fallback when nothing deterministic matches", () => {
    const decision = decide(makeNLU({ intent: "ask_faq", confidence: 0.9, rawMessage: "how much does whitening cost?" }));
    expect(decision).toEqual({
      kind: "execute_tool",
      reason: "No deterministic rule matched -- deferring to the tool-selection model with full conversation context.",
    });
  });

  it("is the fallback for a completely ambiguous, low-confidence message", () => {
    const decision = decide(makeNLU({ intent: "other", confidence: 0.1, rawMessage: "the weather is nice" }));
    expect(decision.kind).toBe("execute_tool");
  });
});

describe("decide: every decision carries a human-readable reason", () => {
  it.each([
    ["emergency_workflow", makeNLU({ urgency: "emergency", rawMessage: "emergency" })],
    ["escalate_to_staff", makeNLU({ intent: "escalate_to_staff", confidence: 0.9 })],
    ["reply_directly", makeNLU({ intent: "greeting", confidence: 0.9 })],
    ["ask_follow_up", makeNLU({ intent: "check_availability", confidence: 0.9 })],
    ["execute_tool", makeNLU({ intent: "ask_faq", confidence: 0.9 })],
  ] as const)("%s", (expectedKind, nlu) => {
    const decision = decide(nlu);
    expect(decision.kind).toBe(expectedKind);
    expect(typeof decision.reason).toBe("string");
    expect(decision.reason.length).toBeGreaterThan(0);
  });
});
