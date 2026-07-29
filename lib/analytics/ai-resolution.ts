import {
  AI_DECISION_KIND_VALUES,
  AI_NLU_INTENT_VALUES,
  AI_TURN_OUTCOME_VALUES,
  type AIDecisionKindValue,
  type AIResolutionMetrics,
  type AINluIntentValue,
  type AITurnOutcomeValue,
} from "@/lib/analytics/types";

export type TurnEventInput = { outcome: string; latency_ms: number };
export type DecisionInput = { decision_kind: string; intent: string; confidence: number };

function zeroRecord<K extends string>(keys: readonly K[]): Record<K, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<K, number>;
}

function isOutcome(value: string): value is AITurnOutcomeValue {
  return (AI_TURN_OUTCOME_VALUES as readonly string[]).includes(value);
}

function isDecisionKind(value: string): value is AIDecisionKindValue {
  return (AI_DECISION_KIND_VALUES as readonly string[]).includes(value);
}

function isIntent(value: string): value is AINluIntentValue {
  return (AI_NLU_INTENT_VALUES as readonly string[]).includes(value);
}

const AUTO_RESOLVED_KINDS = new Set<AIDecisionKindValue>(["ask_follow_up", "execute_tool", "reply_directly"]);
const ESCALATION_KINDS = new Set<AIDecisionKindValue>(["escalate_to_staff", "emergency_workflow"]);
const ERROR_OUTCOMES = new Set<AITurnOutcomeValue>(["llm_error", "tool_calls_exhausted"]);

/**
 * Deterministic aggregation over ai_turn_events + ai_decisions rows --
 * how much of the AI's work happened without human involvement, how
 * often it needed to hand off, and how confident/fast it was. Pure: no
 * I/O, no knowledge of Supabase.
 */
export function computeAIResolutionMetrics(input: { turnEvents: TurnEventInput[]; decisions: DecisionInput[] }): AIResolutionMetrics {
  const byOutcome = zeroRecord(AI_TURN_OUTCOME_VALUES);
  for (const event of input.turnEvents) {
    if (isOutcome(event.outcome)) byOutcome[event.outcome] += 1;
  }

  const byDecisionKind = zeroRecord(AI_DECISION_KIND_VALUES);
  const byIntent = zeroRecord(AI_NLU_INTENT_VALUES);
  let confidenceSum = 0;
  for (const decision of input.decisions) {
    if (isDecisionKind(decision.decision_kind)) byDecisionKind[decision.decision_kind] += 1;
    if (isIntent(decision.intent)) byIntent[decision.intent] += 1;
    confidenceSum += decision.confidence;
  }

  const totalTurns = input.turnEvents.length;
  const totalDecisions = input.decisions.length;

  let autoResolved = 0;
  let escalated = 0;
  for (const kind of AI_DECISION_KIND_VALUES) {
    if (AUTO_RESOLVED_KINDS.has(kind)) autoResolved += byDecisionKind[kind];
    if (ESCALATION_KINDS.has(kind)) escalated += byDecisionKind[kind];
  }

  let errorTurns = 0;
  for (const outcome of AI_TURN_OUTCOME_VALUES) {
    if (ERROR_OUTCOMES.has(outcome)) errorTurns += byOutcome[outcome];
  }

  const avgLatencyMs = totalTurns === 0 ? 0 : input.turnEvents.reduce((sum, e) => sum + e.latency_ms, 0) / totalTurns;

  return {
    totalTurns,
    byOutcome,
    totalDecisions,
    byDecisionKind,
    byIntent,
    autoResolvedRate: totalDecisions === 0 ? 0 : autoResolved / totalDecisions,
    escalationRate: totalDecisions === 0 ? 0 : escalated / totalDecisions,
    errorRate: totalTurns === 0 ? 0 : errorTurns / totalTurns,
    avgConfidence: totalDecisions === 0 ? 0 : confidenceSum / totalDecisions,
    avgLatencyMs,
  };
}
