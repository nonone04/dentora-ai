import { AnthropicLLMClient } from "@/lib/ai/llm/anthropic-client";
import type { LLMClient } from "@/lib/ai/llm/client";
import { MockLLMClient } from "@/lib/ai/llm/mock-client";

let cachedClient: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!cachedClient) {
    cachedClient = process.env.ANTHROPIC_API_KEY
      ? new AnthropicLLMClient(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL)
      : new MockLLMClient();
  }
  return cachedClient;
}

export type { LLMClient, LLMMessage, LLMResponse, LLMTool, LLMToolCall } from "@/lib/ai/llm/client";
