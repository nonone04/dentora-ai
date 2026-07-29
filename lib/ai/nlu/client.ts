import type { LLMMessage } from "@/lib/ai/llm/client";
import type { NLUExtraction } from "@/lib/ai/nlu/types";

/** Provider-agnostic contract for the NLU extraction step -- mirrors lib/ai/llm/client.ts's LLMClient. */
export interface NLUClient {
  extract(params: { messages: LLMMessage[]; clinicName: string }): Promise<NLUExtraction>;
}
