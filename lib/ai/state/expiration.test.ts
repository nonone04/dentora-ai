import { describe, expect, it } from "vitest";
import { isExpired, STATE_TTL_MS } from "@/lib/ai/state/expiration";
import { createInitialState } from "@/lib/ai/state/factory";

const NOW = new Date("2026-07-28T12:00:00Z");

function stateWithLastActivity(lastActivityAt: string) {
  return { ...createInitialState({ clinicId: "clinic-1", conversationId: "conv-1" }), lastActivityAt };
}

describe("isExpired", () => {
  it("is not expired immediately after activity", () => {
    const state = stateWithLastActivity(NOW.toISOString());
    expect(isExpired(state, NOW)).toBe(false);
  });

  it("is not expired just under the TTL", () => {
    const lastActivityAt = new Date(NOW.getTime() - (STATE_TTL_MS - 1000)).toISOString();
    expect(isExpired(stateWithLastActivity(lastActivityAt), NOW)).toBe(false);
  });

  it("is expired once the TTL has elapsed", () => {
    const lastActivityAt = new Date(NOW.getTime() - (STATE_TTL_MS + 1000)).toISOString();
    expect(isExpired(stateWithLastActivity(lastActivityAt), NOW)).toBe(true);
  });

  it("respects a custom TTL", () => {
    const lastActivityAt = new Date(NOW.getTime() - 5000).toISOString();
    expect(isExpired(stateWithLastActivity(lastActivityAt), NOW, 1000)).toBe(true);
    expect(isExpired(stateWithLastActivity(lastActivityAt), NOW, 10_000)).toBe(false);
  });

  it("treats a corrupt/unparseable timestamp as expired", () => {
    expect(isExpired(stateWithLastActivity("not a date"), NOW)).toBe(true);
  });
});
