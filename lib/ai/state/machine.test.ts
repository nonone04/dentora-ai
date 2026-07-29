import { describe, expect, it } from "vitest";
import { transition } from "@/lib/ai/state/machine";
import type { AIDecisionKind } from "@/lib/ai/decision/types";
import type { ConversationStatus } from "@/lib/ai/state/types";

describe("transition: direct decision -> status mapping", () => {
  it.each([
    ["active", "ask_follow_up", "collecting"],
    ["active", "execute_tool", "ready"],
    ["active", "escalate_to_staff", "escalated"],
    ["active", "emergency_workflow", "escalated"],
    ["active", "reply_directly", "active"],
    ["collecting", "ask_follow_up", "collecting"],
    ["collecting", "execute_tool", "ready"],
    ["collecting", "reply_directly", "active"],
    ["ready", "ask_follow_up", "collecting"],
    ["ready", "execute_tool", "ready"],
    ["ready", "reply_directly", "active"],
  ] as [ConversationStatus, AIDecisionKind, ConversationStatus][])("%s + %s -> %s", (from, decisionKind, expected) => {
    expect(transition(from, decisionKind)).toBe(expected);
  });
});

describe("transition: escalated is sticky", () => {
  it("stays escalated for every decision kind other than a fresh escalation/emergency", () => {
    const nonEscalating: AIDecisionKind[] = ["ask_follow_up", "execute_tool", "reply_directly"];
    for (const kind of nonEscalating) {
      expect(transition("escalated", kind)).toBe("escalated");
    }
  });

  it("stays escalated for another escalation or emergency too", () => {
    expect(transition("escalated", "escalate_to_staff")).toBe("escalated");
    expect(transition("escalated", "emergency_workflow")).toBe("escalated");
  });

  it("cannot be left via any decision kind at all", () => {
    const allKinds: AIDecisionKind[] = [
      "ask_follow_up",
      "execute_tool",
      "escalate_to_staff",
      "emergency_workflow",
      "reply_directly",
    ];
    for (const kind of allKinds) {
      expect(transition("escalated", kind)).toBe("escalated");
    }
  });
});

describe("transition: emergency/escalation always wins from any starting status", () => {
  it.each(["active", "collecting", "ready", "escalated"] as ConversationStatus[])("%s -> escalated on emergency_workflow", (from) => {
    expect(transition(from, "emergency_workflow")).toBe("escalated");
  });

  it.each(["active", "collecting", "ready", "escalated"] as ConversationStatus[])("%s -> escalated on escalate_to_staff", (from) => {
    expect(transition(from, "escalate_to_staff")).toBe("escalated");
  });
});
