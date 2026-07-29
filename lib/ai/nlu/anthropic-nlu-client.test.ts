import { beforeEach, describe, expect, it, vi } from "vitest";

const { completeMock } = vi.hoisted(() => ({ completeMock: vi.fn() }));

vi.mock("@/lib/ai/llm/anthropic-client", () => ({
  AnthropicLLMClient: class {
    complete = completeMock;
  },
}));

import { AnthropicNLUClient } from "@/lib/ai/nlu/anthropic-nlu-client";
import { NLU_EXTRACTION_TOOL_NAME } from "@/lib/ai/nlu/schema";

beforeEach(() => {
  completeMock.mockReset();
});

describe("AnthropicNLUClient", () => {
  it("forces the extract_nlu tool choice and parses the resulting tool call", async () => {
    completeMock.mockResolvedValue({
      type: "tool_calls",
      toolCalls: [
        {
          id: "call_1",
          name: NLU_EXTRACTION_TOOL_NAME,
          input: {
            intent: "check_availability",
            entities: { date: "2026-08-01", time: null, service: null, dentist: null, patientName: null, phone: null },
            urgency: "low",
            language: "en",
            confidence: 0.9,
          },
        },
      ],
    });

    const client = new AnthropicNLUClient("test-key");
    const result = await client.extract({
      clinicName: "Test Clinic",
      messages: [{ role: "user", content: "Any openings tomorrow?" }],
    });

    expect(completeMock).toHaveBeenCalledTimes(1);
    const callArgs = completeMock.mock.calls[0][0];
    expect(callArgs.toolChoice).toEqual({ type: "tool", name: NLU_EXTRACTION_TOOL_NAME });
    expect(callArgs.tools).toHaveLength(1);
    expect(callArgs.tools[0].name).toBe(NLU_EXTRACTION_TOOL_NAME);

    expect(result.intent).toBe("check_availability");
    expect(result.entities.date).toBe("2026-08-01");
    expect(result.confidence).toBe(0.9);
    expect(result.rawMessage).toBe("Any openings tomorrow?");
  });

  it("fails safe to a zero-confidence extraction if the model ignores the forced tool choice", async () => {
    completeMock.mockResolvedValue({ type: "text", text: "Sure, let me check that for you!" });

    const client = new AnthropicNLUClient("test-key");
    const result = await client.extract({ clinicName: "Test Clinic", messages: [{ role: "user", content: "hi" }] });

    expect(result.intent).toBe("other");
    expect(result.confidence).toBe(0);
    expect(result.rawMessage).toBe("hi");
  });

  it("propagates a hard LLM failure (e.g. Anthropic outage) to the caller rather than swallowing it silently", async () => {
    completeMock.mockRejectedValue(new Error("Anthropic API error (500): boom"));

    const client = new AnthropicNLUClient("test-key");
    await expect(
      client.extract({ clinicName: "Test Clinic", messages: [{ role: "user", content: "hi" }] }),
    ).rejects.toThrow("boom");
  });
});
