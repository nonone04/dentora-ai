import type { TraceStep } from "@/lib/observability/trace/types";

export type MessageRow = { role: string; content: string; ai_action: string | null; created_at: string };
export type NluExtractionRow = {
  intent: string;
  urgency: string;
  language: string;
  confidence: number;
  missing_fields: string[];
  latency_ms: number;
  created_at: string;
};
export type DecisionRow = { decision_kind: string; reason: string; intent: string; urgency: string; confidence: number; latency_ms: number; created_at: string };
export type AvailabilityQueryRow = { requested_date: string; options_count: number; fallback_count: number; latency_ms: number; created_at: string };
export type KnowledgeSearchRow = { query: string; hit: boolean; matched_record_ids: string[]; latency_ms: number; created_at: string };
export type LifecycleEventRow = { entity_type: string; event: string; from_status: string | null; to_status: string; actor: string; created_at: string };
export type NotificationEventRow = { type: string; created_at: string };
export type TurnEventRow = { outcome: string; iteration_count: number; latency_ms: number; model: string | null; created_at: string };

export type TraceRawData = {
  messages: MessageRow[];
  nluExtractions: NluExtractionRow[];
  decisions: DecisionRow[];
  availabilityQueries: AvailabilityQueryRow[];
  knowledgeSearches: KnowledgeSearchRow[];
  lifecycleEvents: LifecycleEventRow[];
  notificationEvents: NotificationEventRow[];
  turnEvents: TurnEventRow[];
};

function capitalize(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

function truncate(value: string, maxLength = 120): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

/**
 * Merges every engine's logged rows for one conversation into a single,
 * chronologically-ordered list of human-readable steps. Pure: given the
 * same raw rows, always the same trace -- all the actual fetching lives
 * in lib/observability/trace/query.ts. A message with an ai_action set
 * is reclassified as a "tool_call" step rather than a plain "message"
 * step -- that's the orchestrator's existing convention for recording a
 * tool call's bookkeeping in ai_messages (see lib/ai/orchestrator.ts),
 * reused here rather than duplicated.
 */
export function reconstructTraceSteps(raw: TraceRawData): TraceStep[] {
  const steps: TraceStep[] = [];

  for (const message of raw.messages) {
    if (message.role === "assistant" && message.ai_action) {
      steps.push({
        type: "tool_call",
        timestamp: message.created_at,
        summary: `AI called tool "${message.ai_action}"`,
        data: { role: message.role, aiAction: message.ai_action, content: message.content },
      });
    } else {
      steps.push({
        type: "message",
        timestamp: message.created_at,
        summary: `${capitalize(message.role)}: ${truncate(message.content)}`,
        data: { role: message.role, content: message.content },
      });
    }
  }

  for (const nlu of raw.nluExtractions) {
    steps.push({
      type: "nlu_extraction",
      timestamp: nlu.created_at,
      summary: `Understood intent "${nlu.intent}" (urgency: ${nlu.urgency}, confidence: ${nlu.confidence.toFixed(2)})${
        nlu.missing_fields.length > 0 ? `, missing: ${nlu.missing_fields.join(", ")}` : ""
      }`,
      data: { ...nlu },
    });
  }

  for (const decision of raw.decisions) {
    steps.push({
      type: "decision",
      timestamp: decision.created_at,
      summary: `Decided to ${decision.decision_kind.replace(/_/g, " ")} -- ${decision.reason}`,
      data: { ...decision },
    });
  }

  for (const query of raw.availabilityQueries) {
    steps.push({
      type: "availability_query",
      timestamp: query.created_at,
      summary: `Checked availability for ${query.requested_date}: ${query.options_count} option(s)${
        query.fallback_count > 0 ? `, ${query.fallback_count} fallback(s)` : ""
      }`,
      data: { ...query },
    });
  }

  for (const search of raw.knowledgeSearches) {
    steps.push({
      type: "knowledge_search",
      timestamp: search.created_at,
      summary: `Searched clinic knowledge for "${truncate(search.query, 60)}": ${search.hit ? "found a match" : "no match"}`,
      data: { ...search },
    });
  }

  for (const event of raw.lifecycleEvents) {
    steps.push({
      type: "lifecycle_event",
      timestamp: event.created_at,
      summary: `${capitalize(event.entity_type)} ${event.event.replace(/_/g, " ")}: ${event.from_status ?? "(none)"} -> ${event.to_status} (${event.actor})`,
      data: { ...event },
    });
  }

  for (const event of raw.notificationEvents) {
    steps.push({
      type: "notification_event",
      timestamp: event.created_at,
      summary: `Notification triggered: ${event.type.replace(/_/g, " ")}`,
      data: { ...event },
    });
  }

  for (const turn of raw.turnEvents) {
    steps.push({
      type: "turn",
      timestamp: turn.created_at,
      summary: `Turn completed (${turn.outcome.replace(/_/g, " ")}) in ${turn.iteration_count} iteration(s), ${turn.latency_ms}ms`,
      data: { ...turn },
    });
  }

  return steps.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}
