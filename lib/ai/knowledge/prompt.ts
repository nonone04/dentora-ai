import type { KnowledgeSearchResult } from "@/lib/ai/knowledge/types";

/**
 * Renders the retrieval result as a grounding block for the
 * patient-facing system prompt (lib/ai/prompt.ts) -- the retrieval-first
 * point of this whole engine: the model answers from *these* specific
 * records instead of a full clinic-profile dump, and is told plainly
 * when nothing matched rather than being left to guess. Returns null
 * only when no search was attempted this turn (the engine didn't run),
 * so lib/ai/prompt.ts can omit the section entirely -- a genuine miss
 * still renders a section, because "we don't have that documented" is
 * itself useful grounding, not an empty result to hide.
 */
export function buildKnowledgeSection(result: KnowledgeSearchResult | null): string | null {
  if (!result) return null;

  const lines = ["# Clinic knowledge"];

  if (result.hit) {
    lines.push("Answer using only the records below -- never state clinic policy, pricing, or hours beyond what's written here.");
    for (const match of result.matches) {
      lines.push(`- ${match.record.title}: ${match.record.content}`);
    }
  } else {
    lines.push(
      `No documented knowledge matched "${result.query}". Say plainly that you don't have that information rather than guessing, and offer to escalate to staff if it matters.`,
    );
  }

  return lines.join("\n");
}
