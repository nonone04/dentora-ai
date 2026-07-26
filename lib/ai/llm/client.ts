/**
 * Provider-agnostic LLM client contract. Mirrors the shape of
 * lib/notifications/provider.ts: an interface, a real implementation
 * gated behind an API key, and a safe default when unconfigured.
 */

export type LLMToolCall = {
  id: string;
  name: string;
  input: Record<string, unknown>;
};

export type LLMMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LLMToolCall[] }
  | { role: "tool"; toolCallId: string; toolName: string; content: string };

export type LLMTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export type LLMUsage = { inputTokens: number; outputTokens: number };

export type LLMResponse =
  | { type: "text"; text: string; usage?: LLMUsage }
  | { type: "tool_calls"; toolCalls: LLMToolCall[]; usage?: LLMUsage };

export interface LLMClient {
  complete(params: { systemPrompt: string; messages: LLMMessage[]; tools: LLMTool[] }): Promise<LLMResponse>;
}
