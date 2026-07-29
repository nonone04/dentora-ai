import { AnthropicNLUClient } from "@/lib/ai/nlu/anthropic-nlu-client";
import type { NLUClient } from "@/lib/ai/nlu/client";
import { RuleBasedNLUClient } from "@/lib/ai/nlu/rule-based-client";
import type { LLMMessage } from "@/lib/ai/llm/client";
import type { NLUExtraction } from "@/lib/ai/nlu/types";

let cachedClient: NLUClient | null = null;

/** Same selection rule as lib/ai/llm/index.ts's getLLMClient -- real model when configured, deterministic fallback otherwise. */
export function getNLUClient(): NLUClient {
  if (!cachedClient) {
    cachedClient = process.env.ANTHROPIC_API_KEY
      ? new AnthropicNLUClient(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL)
      : new RuleBasedNLUClient();
  }
  return cachedClient;
}

export async function extractNLU(params: { messages: LLMMessage[]; clinicName: string }): Promise<NLUExtraction> {
  return getNLUClient().extract(params);
}

export type { NLUClient } from "@/lib/ai/nlu/client";
export { buildFollowUpQuestion } from "@/lib/ai/nlu/follow-up";
export { recordNLUEvent } from "@/lib/ai/nlu/log";
export * from "@/lib/ai/nlu/types";
export { clampConfidence, computeMissingFields, normalizeEntities, parseNLUExtraction } from "@/lib/ai/nlu/validate";
