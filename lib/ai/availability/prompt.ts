import type { AvailabilityResult } from "@/lib/ai/availability/types";

const MAX_OPTIONS_IN_PROMPT = 5;

function formatSlot(slot: { dentistName: string; startAt: string }): string {
  return `  - ${slot.startAt} with ${slot.dentistName}`;
}

/**
 * Renders the engine's result as a grounding block for the patient-facing
 * system prompt (lib/ai/prompt.ts) -- the whole point of running this
 * engine ahead of tool selection: the model presents *these* real slots
 * instead of inventing a time. Returns null when there's nothing to say
 * (the engine didn't run this turn), so lib/ai/prompt.ts can skip the
 * section entirely rather than showing an empty one.
 */
export function buildAvailabilitySection(result: AvailabilityResult | null): string | null {
  if (!result) return null;

  const lines = ["# Real-time availability", "Only offer appointment times that appear below -- never invent or guess a time."];

  if (result.options.length > 0) {
    lines.push(`Available on ${result.query.date} (top matches):`);
    lines.push(...result.options.slice(0, MAX_OPTIONS_IN_PROMPT).map(formatSlot));
  } else if (result.fallbacks.length > 0) {
    lines.push(`No availability on ${result.query.date}. Nearest alternative -- ${result.fallbackDate}:`);
    lines.push(...result.fallbacks.slice(0, MAX_OPTIONS_IN_PROMPT).map(formatSlot));
  } else {
    lines.push(`No availability found on ${result.query.date} or in the following days -- suggest the patient contact the clinic directly or try a different date.`);
  }

  if (result.conflicts.length > 0) {
    lines.push("Notes:");
    lines.push(...result.conflicts.map((conflict) => `  - ${conflict.message}`));
  }

  return lines.join("\n");
}
