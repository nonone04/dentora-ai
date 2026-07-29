import type { ConversationListItem } from "@/app/actions/ai-inspector";
import type { TraceStep } from "@/lib/observability";
import type { ConversationListFilters, InspectorFilters } from "@/lib/ai-inspector/types";
import { stepSeverity } from "@/lib/ai-inspector/step-meta";

/**
 * Search matches against the step's raw summary/data rather than any
 * localized label -- the underlying content (patient messages, tool
 * inputs, reasons) is what staff are actually searching for, and it's
 * already in whatever language the conversation happened in.
 */
export function matchesStepFilters(step: TraceStep, filters: InspectorFilters): boolean {
  if (filters.stepTypes.length > 0 && !filters.stepTypes.includes(step.type)) return false;
  if (filters.errorsOnly && stepSeverity(step) === "normal") return false;
  if (filters.search.trim()) {
    const needle = filters.search.trim().toLowerCase();
    const haystack = `${step.summary} ${JSON.stringify(step.data)}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}

export function matchesConversationListFilters(conversation: ConversationListItem, filters: ConversationListFilters): boolean {
  if (filters.statuses.length > 0 && !filters.statuses.includes(conversation.status)) return false;
  if (filters.channels.length > 0 && !filters.channels.includes(conversation.channel)) return false;
  if (filters.search.trim()) {
    const needle = filters.search.trim().toLowerCase();
    const haystack = `${conversation.patientName ?? ""} ${conversation.patientPhone ?? ""}`.toLowerCase();
    if (!haystack.includes(needle)) return false;
  }
  return true;
}
