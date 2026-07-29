import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeMock } = vi.hoisted(() => ({ completeMock: vi.fn() }));

vi.mock("@/lib/ai/llm/anthropic-client", () => ({
  AnthropicLLMClient: class {
    complete = completeMock;
  },
}));

const { generateLLMSummary } = await import("@/lib/ai/patient/llm-summary");

const INPUTS = {
  patientName: "Sara Idrissi",
  reliability: { score: 0.8, label: "good" as const, completedCount: 4, noShowCount: 1, cancelledCount: 0, sampleSize: 5 },
  communication: { preferredChannel: "whatsapp" as const, sampleSize: 3 },
  scheduling: { preferredTimeOfDay: "morning" as const, preferredDentistId: "dentist-1", sampleSize: 4 },
  recentActivity: ["Appointment completed", "Started a conversation with the AI assistant"],
};

beforeEach(() => {
  completeMock.mockReset();
});

describe("generateLLMSummary", () => {
  it("returns the model's text response, trimmed", async () => {
    completeMock.mockResolvedValue({ type: "text", text: "  Sara is a reliable patient who prefers WhatsApp.  " });

    const result = await generateLLMSummary("test-key", undefined, INPUTS);

    expect(result).toBe("Sara is a reliable patient who prefers WhatsApp.");
    expect(completeMock).toHaveBeenCalledTimes(1);
    const callArgs = completeMock.mock.calls[0][0];
    expect(callArgs.tools).toEqual([]);
    expect(callArgs.messages[0].content).toContain("Sara Idrissi");
    expect(callArgs.messages[0].content).toContain("good");
    expect(callArgs.messages[0].content).toContain("whatsapp");
  });

  it("returns null when the model responds with tool_calls instead of text (unexpected but handled)", async () => {
    completeMock.mockResolvedValue({ type: "tool_calls", toolCalls: [] });
    const result = await generateLLMSummary("test-key", undefined, INPUTS);
    expect(result).toBeNull();
  });

  it("returns null for an empty text response rather than an empty string", async () => {
    completeMock.mockResolvedValue({ type: "text", text: "   " });
    const result = await generateLLMSummary("test-key", undefined, INPUTS);
    expect(result).toBeNull();
  });

  it("returns null (never throws) when the underlying LLM call fails", async () => {
    completeMock.mockRejectedValue(new Error("Anthropic API error (500): boom"));
    const result = await generateLLMSummary("test-key", undefined, INPUTS);
    expect(result).toBeNull();
  });

  it("includes recent activity in the facts message when given", async () => {
    completeMock.mockResolvedValue({ type: "text", text: "Summary." });
    await generateLLMSummary("test-key", undefined, INPUTS);
    const callArgs = completeMock.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("Appointment completed");
  });

  it("says there's no established preference rather than omitting it silently", async () => {
    completeMock.mockResolvedValue({ type: "text", text: "Summary." });
    await generateLLMSummary("test-key", undefined, {
      ...INPUTS,
      communication: { preferredChannel: null, sampleSize: 0 },
      scheduling: { preferredTimeOfDay: null, preferredDentistId: null, sampleSize: 0 },
    });
    const callArgs = completeMock.mock.calls[0][0];
    expect(callArgs.messages[0].content).toContain("No established contact channel preference yet.");
    expect(callArgs.messages[0].content).toContain("No established time-of-day preference yet.");
  });
});
