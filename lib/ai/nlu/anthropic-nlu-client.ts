import { AnthropicLLMClient } from "@/lib/ai/llm/anthropic-client";
import type { LLMMessage } from "@/lib/ai/llm/client";
import type { NLUClient } from "@/lib/ai/nlu/client";
import { buildNLUSystemPrompt } from "@/lib/ai/nlu/prompt";
import { NLU_EXTRACTION_TOOL_NAME, NLU_EXTRACTION_TOOL_SCHEMA } from "@/lib/ai/nlu/schema";
import type { NLUExtraction } from "@/lib/ai/nlu/types";
import { parseNLUExtraction } from "@/lib/ai/nlu/validate";

/**
 * Real NLU extraction against Anthropic, forcing a single tool call
 * (extract_nlu) so the response is always structured JSON rather than
 * free text -- reuses AnthropicLLMClient for the actual request/retry/
 * timeout handling instead of duplicating it.
 */
export class AnthropicNLUClient implements NLUClient {
  private readonly llm: AnthropicLLMClient;

  constructor(apiKey: string, model?: string) {
    this.llm = new AnthropicLLMClient(apiKey, model);
  }

  async extract({ messages, clinicName }: { messages: LLMMessage[]; clinicName: string }): Promise<NLUExtraction> {
    const rawMessage = lastUserMessage(messages);

    const response = await this.llm.complete({
      systemPrompt: buildNLUSystemPrompt(clinicName),
      messages,
      tools: [
        {
          name: NLU_EXTRACTION_TOOL_NAME,
          description: "Record the structured reading of the patient's latest message.",
          inputSchema: NLU_EXTRACTION_TOOL_SCHEMA,
        },
      ],
      toolChoice: { type: "tool", name: NLU_EXTRACTION_TOOL_NAME },
    });

    if (response.type === "tool_calls") {
      const call = response.toolCalls.find((candidate) => candidate.name === NLU_EXTRACTION_TOOL_NAME);
      if (call) return parseNLUExtraction(call.input, rawMessage);
    }

    // The forced tool choice should make this unreachable, but an
    // external API's response shape is never something to trust
    // blindly -- fail safe to a zero-confidence "other" extraction
    // rather than throwing and taking the whole turn down with it.
    return parseNLUExtraction({}, rawMessage);
  }
}

function lastUserMessage(messages: LLMMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}
