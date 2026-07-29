import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnthropicLLMClient } from "@/lib/ai/llm/anthropic-client";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("AnthropicLLMClient toolChoice", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("omits tool_choice from the request body when not specified", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ content: [{ type: "text", text: "hi" }] }));

    const client = new AnthropicLLMClient("test-key");
    await client.complete({ systemPrompt: "sys", messages: [{ role: "user", content: "hello" }], tools: [] });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.tool_choice).toBeUndefined();
  });

  it("forces a named tool when toolChoice is provided", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ content: [{ type: "tool_use", id: "call_1", name: "extract_nlu", input: {} }] }),
    );

    const client = new AnthropicLLMClient("test-key");
    await client.complete({
      systemPrompt: "sys",
      messages: [{ role: "user", content: "hello" }],
      tools: [{ name: "extract_nlu", description: "d", inputSchema: {} }],
      toolChoice: { type: "tool", name: "extract_nlu" },
    });

    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(requestBody.tool_choice).toEqual({ type: "tool", name: "extract_nlu" });
  });
});
