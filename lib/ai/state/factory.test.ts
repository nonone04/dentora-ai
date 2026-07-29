import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/ai/state/factory";
import { EMPTY_ENTITIES } from "@/lib/ai/nlu/types";

describe("createInitialState", () => {
  it("returns a fresh, never-persisted, no-op state", () => {
    const state = createInitialState({ clinicId: "clinic-1", conversationId: "conv-1" });

    expect(state.clinicId).toBe("clinic-1");
    expect(state.conversationId).toBe("conv-1");
    expect(state.status).toBe("active");
    expect(state.intent).toBe("other");
    expect(state.entities).toEqual(EMPTY_ENTITIES);
    expect(state.urgency).toBe("low");
    expect(state.language).toBe("other");
    expect(state.confidence).toBe(0);
    expect(state.missingFields).toEqual([]);
    expect(state.turnCount).toBe(0);
    expect(state.lastMessage).toBe("");
    expect(state.version).toBe(0);
  });

  it("stamps lastActivityAt with a valid, current-ish timestamp", () => {
    const before = Date.now();
    const state = createInitialState({ clinicId: "clinic-1", conversationId: "conv-1" });
    const after = Date.now();

    const stamped = new Date(state.lastActivityAt).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });
});
