import type { LLMClient, LLMMessage, LLMResponse, LLMTool } from "@/lib/ai/llm/client";

/**
 * Default when ANTHROPIC_API_KEY isn't configured (true of this
 * environment right now). Not a no-op stub -- it has simple,
 * deliberately dumb keyword-triggered tool-calling behavior so the
 * orchestration loop (tool gets called -> result fed back -> final
 * answer) can be verified mechanically without a real model.
 */
export class MockLLMClient implements LLMClient {
  async complete({
    messages,
    tools,
  }: {
    systemPrompt: string;
    messages: LLMMessage[];
    tools: LLMTool[];
  }): Promise<LLMResponse> {
    const last = messages[messages.length - 1];

    // A tool result just came back -- summarize it as the final answer.
    if (last?.role === "tool") {
      return {
        type: "text",
        text: `[mock] Here's what I found: ${last.content.slice(0, 800)}`,
      };
    }

    const text = last?.role === "user" ? last.content.toLowerCase() : "";
    const available = new Set(tools.map((tool) => tool.name));

    const wantsTool = (name: string, keywords: string[]) =>
      available.has(name) && keywords.some((keyword) => text.includes(keyword));

    if (wantsTool("get_clinic_info", ["hour", "open", "address", "phone", "contact"])) {
      return { type: "tool_calls", toolCalls: [{ id: mockId(), name: "get_clinic_info", input: {} }] };
    }

    if (wantsTool("list_services", ["service", "price", "cost", "offer"])) {
      return { type: "tool_calls", toolCalls: [{ id: mockId(), name: "list_services", input: {} }] };
    }

    if (wantsTool("check_availability", ["available", "availability", "slot", "when can"])) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return {
        type: "tool_calls",
        toolCalls: [{ id: mockId(), name: "check_availability", input: { date: tomorrow } }],
      };
    }

    return {
      type: "text",
      text: "[mock] I'm a placeholder assistant (no ANTHROPIC_API_KEY configured). I can look up clinic info, services, or availability if you ask about them.",
    };
  }
}

function mockId() {
  return `mock_${crypto.randomUUID().slice(0, 8)}`;
}
