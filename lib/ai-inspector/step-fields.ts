import { interpolate } from "@/lib/i18n";
import type { Dictionary } from "@/lib/i18n";
import type {
  AvailabilityQueryRow,
  DecisionRow,
  KnowledgeSearchRow,
  LifecycleEventRow,
  NluExtractionRow,
  NotificationEventRow,
  TraceStep,
  TurnEventRow,
} from "@/lib/observability";

export type StepField = { label: string; value: string };

function enumLabel(dict: Record<string, string> | undefined, value: string): string {
  if (dict?.[value]) return dict[value];
  const humanized = value.replace(/_/g, " ");
  return humanized.length === 0 ? humanized : humanized[0].toUpperCase() + humanized.slice(1);
}

function statusLabel(status: string, t: Dictionary): string {
  return enumLabel(t.appointmentStatus as unknown as Record<string, string>, status);
}

function yesNo(value: boolean, t: Dictionary): string {
  return value ? t.aiInspector.fields.yes : t.aiInspector.fields.no;
}

/**
 * One-line, localized description for a step's Accordion trigger --
 * deliberately NOT lib/observability/trace/reconstruct.ts's own
 * `summary` field, which is a fixed English string baked at the data
 * layer (see that module's own docs). Reads the same raw `data`
 * instead, so every locale gets a real translation.
 */
export function stepPrimaryText(step: TraceStep, t: Dictionary): string {
  switch (step.type) {
    case "message":
      return (step.data as { content: string }).content;
    case "tool_call": {
      const data = step.data as { aiAction: string };
      return interpolate(t.aiInspector.timeline.toolCallText, { tool: data.aiAction });
    }
    case "nlu_extraction": {
      const data = step.data as unknown as NluExtractionRow;
      return `${enumLabel(t.aiInspector.intent, data.intent)} · ${enumLabel(t.aiInspector.urgency, data.urgency)}`;
    }
    case "decision": {
      const data = step.data as unknown as DecisionRow;
      return `${enumLabel(t.aiInspector.decisionKind, data.decision_kind)} — ${data.reason}`;
    }
    case "availability_query": {
      const data = step.data as unknown as AvailabilityQueryRow;
      return interpolate(t.aiInspector.timeline.availabilityText, { count: data.options_count, date: data.requested_date });
    }
    case "knowledge_search": {
      const data = step.data as unknown as KnowledgeSearchRow;
      return interpolate(data.hit ? t.aiInspector.timeline.knowledgeHitText : t.aiInspector.timeline.knowledgeMissText, { query: data.query });
    }
    case "lifecycle_event": {
      const data = step.data as unknown as LifecycleEventRow;
      return interpolate(t.aiInspector.timeline.lifecycleText, {
        entity: enumLabel(undefined, data.entity_type),
        event: enumLabel(undefined, data.event),
        from: data.from_status ? statusLabel(data.from_status, t) : t.aiInspector.fields.none,
        to: statusLabel(data.to_status, t),
      });
    }
    case "notification_event": {
      const data = step.data as unknown as NotificationEventRow;
      return enumLabel(t.dashboard.notificationCenter.events as unknown as Record<string, string>, data.type);
    }
    case "turn": {
      const data = step.data as unknown as TurnEventRow;
      return enumLabel(t.aiInspector.turnOutcome, data.outcome);
    }
    default:
      return step.summary;
  }
}

/** Structured, labeled field rows for a step's expanded detail panel -- everything the primary text/badges don't already surface. */
export function stepFields(step: TraceStep, t: Dictionary): StepField[] {
  const f = t.aiInspector.fields;

  switch (step.type) {
    case "message": {
      const data = step.data as { role: string };
      return [{ label: f.role, value: t.aiInspector.roles[data.role as keyof typeof t.aiInspector.roles] ?? data.role }];
    }
    case "tool_call": {
      const data = step.data as { role: string; aiAction: string };
      return [
        { label: f.role, value: t.aiInspector.roles[data.role as keyof typeof t.aiInspector.roles] ?? data.role },
        { label: f.tool, value: data.aiAction },
      ];
    }
    case "nlu_extraction": {
      const data = step.data as unknown as NluExtractionRow;
      const fields: StepField[] = [
        { label: f.intent, value: enumLabel(t.aiInspector.intent, data.intent) },
        { label: f.urgency, value: enumLabel(t.aiInspector.urgency, data.urgency) },
        { label: f.language, value: t.aiInspector.language[data.language as keyof typeof t.aiInspector.language] ?? data.language },
      ];
      if (data.missing_fields.length > 0) fields.push({ label: f.missingFields, value: data.missing_fields.join(", ") });
      return fields;
    }
    case "decision": {
      const data = step.data as unknown as DecisionRow;
      return [
        { label: f.intent, value: enumLabel(t.aiInspector.intent, data.intent) },
        { label: f.urgency, value: enumLabel(t.aiInspector.urgency, data.urgency) },
        { label: f.reason, value: data.reason },
      ];
    }
    case "availability_query": {
      const data = step.data as unknown as AvailabilityQueryRow;
      return [
        { label: f.requestedDate, value: data.requested_date },
        { label: f.optionsCount, value: String(data.options_count) },
        { label: f.fallbackCount, value: String(data.fallback_count) },
      ];
    }
    case "knowledge_search": {
      const data = step.data as unknown as KnowledgeSearchRow;
      const fields: StepField[] = [
        { label: f.query, value: data.query },
        { label: f.hit, value: yesNo(data.hit, t) },
      ];
      if (data.matched_record_ids.length > 0) fields.push({ label: f.matchedRecords, value: String(data.matched_record_ids.length) });
      return fields;
    }
    case "lifecycle_event": {
      const data = step.data as unknown as LifecycleEventRow;
      return [
        { label: f.entityType, value: enumLabel(undefined, data.entity_type) },
        { label: f.event, value: enumLabel(undefined, data.event) },
        { label: f.fromStatus, value: data.from_status ? statusLabel(data.from_status, t) : f.none },
        { label: f.toStatus, value: statusLabel(data.to_status, t) },
        { label: f.actor, value: enumLabel(undefined, data.actor) },
      ];
    }
    case "notification_event": {
      const data = step.data as unknown as NotificationEventRow;
      return [{ label: f.notificationType, value: enumLabel(t.dashboard.notificationCenter.events as unknown as Record<string, string>, data.type) }];
    }
    case "turn": {
      const data = step.data as unknown as TurnEventRow;
      const fields: StepField[] = [
        { label: f.outcome, value: enumLabel(t.aiInspector.turnOutcome, data.outcome) },
        { label: f.iterations, value: String(data.iteration_count) },
      ];
      if (data.model) fields.push({ label: f.model, value: data.model });
      return fields;
    }
    default:
      return [];
  }
}
