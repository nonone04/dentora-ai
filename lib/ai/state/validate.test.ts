import { describe, expect, it } from "vitest";
import { isConversationStatus, parseConversationState, stateToRow, type ConversationStateRow } from "@/lib/ai/state/validate";
import { EMPTY_ENTITIES } from "@/lib/ai/nlu/types";
import { createInitialState } from "@/lib/ai/state/factory";

function makeRow(overrides: Partial<ConversationStateRow> = {}): ConversationStateRow {
  return {
    clinic_id: "clinic-1",
    conversation_id: "conv-1",
    status: "collecting",
    intent: "book_appointment",
    entities: { date: "2026-08-05", time: null, service: "cleaning", dentist: null, patientName: null, phone: null },
    urgency: "low",
    language: "fr",
    confidence: 0.7,
    turn_count: 2,
    last_message: "book a cleaning for 2026-08-05",
    version: 3,
    last_activity_at: "2026-07-28T12:00:00.000Z",
    ...overrides,
  };
}

describe("isConversationStatus", () => {
  it("accepts known statuses", () => {
    expect(isConversationStatus("active")).toBe(true);
    expect(isConversationStatus("collecting")).toBe(true);
    expect(isConversationStatus("ready")).toBe(true);
    expect(isConversationStatus("escalated")).toBe(true);
  });

  it("rejects unknown or wrongly-typed values", () => {
    expect(isConversationStatus("archived")).toBe(false);
    expect(isConversationStatus(42)).toBe(false);
    expect(isConversationStatus(null)).toBe(false);
  });
});

describe("parseConversationState", () => {
  it("parses a well-formed row", () => {
    const state = parseConversationState(makeRow());

    expect(state.clinicId).toBe("clinic-1");
    expect(state.conversationId).toBe("conv-1");
    expect(state.status).toBe("collecting");
    expect(state.intent).toBe("book_appointment");
    expect(state.entities.service).toBe("cleaning");
    expect(state.entities.date).toBe("2026-08-05");
    expect(state.urgency).toBe("low");
    expect(state.language).toBe("fr");
    expect(state.confidence).toBe(0.7);
    expect(state.turnCount).toBe(2);
    expect(state.lastMessage).toBe("book a cleaning for 2026-08-05");
    expect(state.version).toBe(3);
    expect(state.lastActivityAt).toBe("2026-07-28T12:00:00.000Z");
  });

  it("recomputes missingFields from intent+entities rather than trusting anything stored", () => {
    const state = parseConversationState(makeRow());
    // service+date present, patientName absent -> patientName still missing regardless of what was (not) stored.
    expect(state.missingFields).toEqual(["patientName"]);
  });

  it("falls back to safe defaults for every malformed field instead of throwing", () => {
    const state = parseConversationState(
      makeRow({
        clinic_id: 123 as unknown as string,
        status: "bogus_status",
        intent: "delete_everything",
        urgency: "critical",
        language: "klingon",
        confidence: "not a number" as unknown as number,
        turn_count: "two" as unknown as number,
        last_message: 42 as unknown as string,
        version: "three" as unknown as number,
        last_activity_at: 0 as unknown as string,
      }),
    );

    expect(state.clinicId).toBe("");
    expect(state.status).toBe("active");
    expect(state.intent).toBe("other");
    expect(state.urgency).toBe("low");
    expect(state.language).toBe("other");
    expect(state.confidence).toBe(0);
    expect(state.turnCount).toBe(0);
    expect(state.lastMessage).toBe("");
    expect(state.version).toBe(0);
    expect(state.lastActivityAt).toBe(new Date(0).toISOString());
  });

  it("normalizes a garbage entities payload to all-null rather than throwing", () => {
    const state = parseConversationState(makeRow({ entities: "not an object" }));
    expect(state.entities).toEqual(EMPTY_ENTITIES);
  });
});

describe("stateToRow", () => {
  it("maps every field to its snake_case column, using the version passed in rather than the state's own", () => {
    const state = createInitialState({ clinicId: "clinic-1", conversationId: "conv-1" });
    const row = stateToRow({ ...state, status: "ready", intent: "check_availability" }, 5);

    expect(row).toMatchObject({
      clinic_id: "clinic-1",
      conversation_id: "conv-1",
      status: "ready",
      intent: "check_availability",
      version: 5,
    });
    expect(typeof row.last_activity_at).toBe("string");
  });
});
