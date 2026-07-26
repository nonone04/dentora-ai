import type { AIActionName } from "@/lib/ai/actions";

export type AIToolContext = {
  clinicId: string;
  conversationId?: string;
};

export type AITool = {
  /** What the LLM calls this tool by. */
  name: string;
  /** Which Phase 11 AI_ACTIONS permission gates this tool -- checked fresh on every call. */
  requiredAction: AIActionName;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>, context: AIToolContext) => Promise<unknown>;
};
