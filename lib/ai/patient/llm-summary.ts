import { AnthropicLLMClient } from "@/lib/ai/llm/anthropic-client";
import type { SummaryInputs } from "@/lib/ai/patient/rule-summary";

const SYSTEM_PROMPT = [
  "You write a concise, two-to-three sentence internal staff-facing summary of a dental patient, based only on the structured facts given below -- never invent anything not stated.",
  "Plain prose, no bullet points, no greeting, no patient-facing tone (this is for staff, not the patient).",
].join(" ");

function buildFactsMessage(inputs: SummaryInputs & { recentActivity: string[] }): string {
  const { patientName, reliability, communication, scheduling, recentActivity } = inputs;

  const lines = [
    `Patient: ${patientName}`,
    `Appointment history: ${reliability.sampleSize} total -- ${reliability.completedCount} completed, ${reliability.noShowCount} no-show, ${reliability.cancelledCount} cancelled.`,
    `Reliability: ${reliability.label} (score ${reliability.score.toFixed(2)}).`,
    communication.preferredChannel
      ? `Preferred contact channel: ${communication.preferredChannel}.`
      : "No established contact channel preference yet.",
    scheduling.preferredTimeOfDay
      ? `Preferred appointment time of day: ${scheduling.preferredTimeOfDay}.`
      : "No established time-of-day preference yet.",
    ...(recentActivity.length > 0 ? [`Recent activity, most recent first: ${recentActivity.join("; ")}.`] : []),
  ];

  return lines.join("\n");
}

/**
 * Real, model-generated summary -- only ever called when
 * ANTHROPIC_API_KEY is configured (see lib/ai/patient/summary.ts's
 * factory). Never throws: any failure (network, API error, an empty
 * response) resolves to null so the caller falls back to the
 * deterministic rule-based summary, which is always available.
 */
export async function generateLLMSummary(
  apiKey: string,
  model: string | undefined,
  inputs: SummaryInputs & { recentActivity: string[] },
): Promise<string | null> {
  try {
    const llm = new AnthropicLLMClient(apiKey, model);
    const response = await llm.complete({
      systemPrompt: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildFactsMessage(inputs) }],
      tools: [],
    });

    if (response.type === "text" && response.text.trim()) return response.text.trim();
    return null;
  } catch (err) {
    console.error("[ai:patient] LLM summary generation failed", err instanceof Error ? err.message : err);
    return null;
  }
}
