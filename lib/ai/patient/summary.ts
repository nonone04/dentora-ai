import { generateLLMSummary } from "@/lib/ai/patient/llm-summary";
import { buildRuleBasedSummary, type SummaryInputs } from "@/lib/ai/patient/rule-summary";
import type { SummarySource } from "@/lib/ai/patient/types";

/**
 * Same selection rule as lib/ai/nlu and lib/ai/llm: prefer the real
 * model when ANTHROPIC_API_KEY is configured, otherwise (or if the
 * model call fails) fall back to the deterministic rule-based summary,
 * which is always available and never fails.
 */
export async function generatePatientSummary(
  inputs: SummaryInputs & { recentActivity: string[] },
): Promise<{ summary: string; source: SummarySource }> {
  if (process.env.ANTHROPIC_API_KEY) {
    const llmSummary = await generateLLMSummary(process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_MODEL, inputs);
    if (llmSummary) return { summary: llmSummary, source: "llm" };
  }

  return { summary: buildRuleBasedSummary(inputs), source: "rule_based" };
}
