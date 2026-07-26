import type { LLMClient, LLMMessage, LLMResponse, LLMTool, LLMToolCall, LLMUsage } from "@/lib/ai/llm/client";

const DEFAULT_MODEL = "claude-sonnet-5";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

/**
 * Typed failure for LLM calls so callers (the orchestrator) can tell a
 * transient, worth-a-friendly-retry-message failure (rate limited,
 * Anthropic having an outage, our own timeout) apart from a fatal
 * misconfiguration (bad API key, malformed request) without parsing
 * error strings.
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: AnthropicContentBlock[] | string };

function toAnthropicMessages(messages: LLMMessage[]): AnthropicMessage[] {
  return messages.map((message) => {
    if (message.role === "user") {
      return { role: "user", content: message.content };
    }
    if (message.role === "tool") {
      return {
        role: "user",
        content: [{ type: "tool_result", tool_use_id: message.toolCallId, content: message.content }],
      };
    }
    const blocks: AnthropicContentBlock[] = [];
    if (message.content) blocks.push({ type: "text", text: message.content });
    for (const call of message.toolCalls ?? []) {
      blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
    }
    return { role: "assistant", content: blocks };
  });
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 429 and 5xx are worth retrying; everything else (400/401/403/404) is a fixed request, not a blip. */
function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

/**
 * Real integration against Anthropic's Messages API. Only selected by
 * the factory when ANTHROPIC_API_KEY is configured. Bounded retries
 * with backoff for transient failures (429/5xx/timeout/network error)
 * only -- a bad request or bad key fails fast instead of retrying
 * something that will never succeed.
 */
export class AnthropicLLMClient implements LLMClient {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async complete({
    systemPrompt,
    messages,
    tools,
  }: {
    systemPrompt: string;
    messages: LLMMessage[];
    tools: LLMTool[];
  }): Promise<LLMResponse> {
    const body = JSON.stringify({
      model: this.model,
      max_tokens: 1024,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
      tools: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      })),
    });

    let lastError: LLMError = new LLMError("Anthropic request failed.", true);

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const data = await this.sendRequest(body);
        return this.toLLMResponse(data);
      } catch (err) {
        const llmError =
          err instanceof LLMError ? err : new LLMError(err instanceof Error ? err.message : "Unknown error.", true);
        lastError = llmError;

        if (!llmError.retryable || attempt === MAX_ATTEMPTS) {
          throw llmError;
        }
        await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    throw lastError;
  }

  private async sendRequest(body: string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
          "content-type": "application/json",
        },
        body,
        signal: controller.signal,
      });
    } catch (err) {
      // AbortError (our timeout) and network failures (fetch throwing
      // a TypeError) are both worth retrying -- neither means the
      // request itself was bad.
      const message = err instanceof Error && err.name === "AbortError" ? "Anthropic request timed out." : "Network error calling Anthropic.";
      throw new LLMError(message, true);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const responseBody = await response.text();
      throw new LLMError(
        `Anthropic API error (${response.status}): ${responseBody}`,
        isRetryableStatus(response.status),
        response.status,
      );
    }

    const data = (await response.json().catch(() => null)) as {
      content?: AnthropicContentBlock[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    } | null;

    if (!data || !Array.isArray(data.content)) {
      throw new LLMError("Unexpected response shape from Anthropic API.", false);
    }

    return { content: data.content, usage: data.usage };
  }

  private toLLMResponse(data: {
    content: AnthropicContentBlock[];
    usage?: { input_tokens?: number; output_tokens?: number };
  }): LLMResponse {
    const usage: LLMUsage | undefined = data.usage
      ? { inputTokens: data.usage.input_tokens ?? 0, outputTokens: data.usage.output_tokens ?? 0 }
      : undefined;

    const toolCalls: LLMToolCall[] = data.content
      .filter((block): block is Extract<AnthropicContentBlock, { type: "tool_use" }> => block.type === "tool_use")
      .map((block) => ({ id: block.id, name: block.name, input: block.input }));

    if (toolCalls.length > 0) {
      return { type: "tool_calls", toolCalls, usage };
    }

    const text = data.content
      .filter((block): block is Extract<AnthropicContentBlock, { type: "text" }> => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    return { type: "text", text, usage };
  }
}
