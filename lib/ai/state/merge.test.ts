import { describe, expect, it } from "vitest";
import { mergeExtraction } from "@/lib/ai/state/merge";
import { createInitialState } from "@/lib/ai/state/factory";
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

const BASE_STATE = () => createInitialState({ clinicId: "clinic-1", conversationId: "conv-1" });

describe("mergeExtraction: entities", () => {
  it("fills a gap without touching fields already known", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }));
    const turn2 = mergeExtraction(turn1, makeNLU({ entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }));

    expect(turn2.entities.service).toBe("cleaning");
    expect(turn2.entities.date).toBe("2026-08-05");
  });

  it("lets a new non-null value correct a previously known one", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }));
    const turn2 = mergeExtraction(turn1, makeNLU({ entities: { ...EMPTY_ENTITIES, date: "2026-08-07" } }));

    expect(turn2.entities.date).toBe("2026-08-07");
  });

  it("never lets a null this-turn value erase a previously known field", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }));
    const turn2 = mergeExtraction(turn1, makeNLU({ entities: { ...EMPTY_ENTITIES } }));

    expect(turn2.entities.service).toBe("cleaning");
  });

  it("accumulates every field across many turns", () => {
    let state = BASE_STATE();
    state = mergeExtraction(state, makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }));
    state = mergeExtraction(state, makeNLU({ entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }));
    state = mergeExtraction(state, makeNLU({ entities: { ...EMPTY_ENTITIES, patientName: "Sara Idrissi" } }));
    state = mergeExtraction(state, makeNLU({ entities: { ...EMPTY_ENTITIES, phone: "0612345678" } }));

    expect(state.entities).toEqual({
      date: "2026-08-05",
      time: null,
      service: "cleaning",
      dentist: null,
      patientName: "Sara Idrissi",
      phone: "0612345678",
    });
  });
});

describe("mergeExtraction: intent", () => {
  it("adopts a newly-classified intent when there was none before", () => {
    const merged = mergeExtraction(BASE_STATE(), makeNLU({ intent: "book_appointment" }));
    expect(merged.intent).toBe("book_appointment");
  });

  it("keeps the previously-established intent when this turn is unclassified ('other')", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }));
    // A short reply like "tomorrow" often can't be tied to an intent on its own.
    const turn2 = mergeExtraction(turn1, makeNLU({ intent: "other", entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }));

    expect(turn2.intent).toBe("book_appointment");
    expect(turn2.entities.date).toBe("2026-08-05");
  });

  it("switches intent when the patient clearly pivots to a new one", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }));
    const turn2 = mergeExtraction(turn1, makeNLU({ intent: "cancel_appointment" }));

    expect(turn2.intent).toBe("cancel_appointment");
  });
});

describe("mergeExtraction: urgency", () => {
  it("upgrades urgency when a later turn is more severe", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ urgency: "low" }));
    const turn2 = mergeExtraction(turn1, makeNLU({ urgency: "emergency" }));
    expect(turn2.urgency).toBe("emergency");
  });

  it("never downgrades urgency once elevated, even if the patient calms down", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ urgency: "emergency" }));
    const turn2 = mergeExtraction(turn1, makeNLU({ urgency: "low" }));
    expect(turn2.urgency).toBe("emergency");
  });
});

describe("mergeExtraction: language", () => {
  it("follows a mid-conversation language switch", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ language: "en" }));
    const turn2 = mergeExtraction(turn1, makeNLU({ language: "fr" }));
    expect(turn2.language).toBe("fr");
  });

  it("keeps the last known language when a turn's language is unresolved ('other')", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ language: "ar" }));
    const turn2 = mergeExtraction(turn1, makeNLU({ language: "other" }));
    expect(turn2.language).toBe("ar");
  });
});

describe("mergeExtraction: confidence, turnCount, lastMessage, missingFields", () => {
  it("uses this turn's own confidence, not an accumulated average", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ confidence: 0.9 }));
    const turn2 = mergeExtraction(turn1, makeNLU({ confidence: 0.2 }));
    expect(turn2.confidence).toBe(0.2);
  });

  it("increments turnCount on every merge", () => {
    let state = BASE_STATE();
    expect(state.turnCount).toBe(0);
    state = mergeExtraction(state, makeNLU());
    expect(state.turnCount).toBe(1);
    state = mergeExtraction(state, makeNLU());
    expect(state.turnCount).toBe(2);
  });

  it("tracks the latest raw message", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ rawMessage: "hi" }));
    const turn2 = mergeExtraction(turn1, makeNLU({ rawMessage: "book a cleaning" }));
    expect(turn2.lastMessage).toBe("book a cleaning");
  });

  it("recomputes missingFields from the merged (not per-turn) entities", () => {
    const turn1 = mergeExtraction(BASE_STATE(), makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning" } }));
    expect(turn1.missingFields).toEqual(expect.arrayContaining(["date", "patientName"]));
    expect(turn1.missingFields).not.toContain("service");

    const turn2 = mergeExtraction(turn1, makeNLU({ entities: { ...EMPTY_ENTITIES, date: "2026-08-05" } }));
    expect(turn2.missingFields).toEqual(["patientName"]);
  });

  it("respects patientKnown when recomputing missingFields", () => {
    const state = mergeExtraction(
      BASE_STATE(),
      makeNLU({ intent: "book_appointment", entities: { ...EMPTY_ENTITIES, service: "cleaning", date: "2026-08-05" } }),
      { patientKnown: true },
    );
    expect(state.missingFields).toEqual([]);
  });
});
