import { computeAIResolutionMetrics, computeNotificationMetrics, type DecisionInput, type DeliveryInput, type TurnEventInput } from "@/lib/analytics";
import {
  AI_ERROR_RATE_DEGRADED,
  AI_ERROR_RATE_UNHEALTHY,
  ESCALATION_RATE_DEGRADED,
  ESCALATION_RATE_UNHEALTHY,
  KNOWLEDGE_MISS_RATE_DEGRADED,
  KNOWLEDGE_MISS_RATE_UNHEALTHY,
  MIN_SAMPLE_SIZE,
  NOTIFICATION_FAILURE_RATE_DEGRADED,
  NOTIFICATION_FAILURE_RATE_UNHEALTHY,
} from "@/lib/observability/health/thresholds";
import type { ComponentHealth, HealthStatus } from "@/lib/observability/types";

const STATUS_RANK: Record<HealthStatus, number> = { healthy: 0, degraded: 1, unhealthy: 2 };

/** The worst (highest-severity) of the given statuses -- "healthy" if none are given. */
export function worstOf(...statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>((worst, status) => (STATUS_RANK[status] > STATUS_RANK[worst] ? status : worst), "healthy");
}

function classify(rate: number, degradedAt: number, unhealthyAt: number, sampleSize: number): HealthStatus {
  if (sampleSize < MIN_SAMPLE_SIZE) return "healthy";
  if (rate >= unhealthyAt) return "unhealthy";
  if (rate >= degradedAt) return "degraded";
  return "healthy";
}

function describe(status: HealthStatus, label: string): string {
  if (status === "healthy") return `${label} is operating normally.`;
  if (status === "degraded") return `${label} is showing elevated issues -- worth a look.`;
  return `${label} is failing significantly -- needs attention.`;
}

/** Rolls up ai_turn_events (error rate) + ai_decisions (escalation rate) -- the two ways the orchestrator's own turn can go badly. */
export function computeAIHealthCheck(input: { turnEvents: TurnEventInput[]; decisions: DecisionInput[] }): ComponentHealth {
  const metrics = computeAIResolutionMetrics(input);
  const status = worstOf(
    classify(metrics.errorRate, AI_ERROR_RATE_DEGRADED, AI_ERROR_RATE_UNHEALTHY, metrics.totalTurns),
    classify(metrics.escalationRate, ESCALATION_RATE_DEGRADED, ESCALATION_RATE_UNHEALTHY, metrics.totalDecisions),
  );

  return {
    component: "ai_orchestrator",
    status,
    metrics: {
      totalTurns: metrics.totalTurns,
      totalDecisions: metrics.totalDecisions,
      errorRate: metrics.errorRate,
      escalationRate: metrics.escalationRate,
      avgLatencyMs: metrics.avgLatencyMs,
      avgConfidence: metrics.avgConfidence,
    },
    message: describe(status, "AI orchestrator"),
  };
}

/** Rolls up notification_deliveries -- how reliably patient/staff communications actually go out. */
export function computeNotificationHealthCheck(deliveries: DeliveryInput[]): ComponentHealth {
  const metrics = computeNotificationMetrics(deliveries);
  const status = classify(metrics.failureRate, NOTIFICATION_FAILURE_RATE_DEGRADED, NOTIFICATION_FAILURE_RATE_UNHEALTHY, metrics.total);

  return {
    component: "notifications",
    status,
    metrics: { total: metrics.total, deliveryRate: metrics.deliveryRate, failureRate: metrics.failureRate },
    message: describe(status, "Notification delivery"),
  };
}

export type KnowledgeSearchInput = { hit: boolean };

/** Rolls up clinic_knowledge_searches -- how often the AI actually found something to ground its answer in. */
export function computeKnowledgeHealthCheck(searches: KnowledgeSearchInput[]): ComponentHealth {
  const total = searches.length;
  const misses = searches.filter((search) => !search.hit).length;
  const missRate = total === 0 ? 0 : misses / total;
  const status = classify(missRate, KNOWLEDGE_MISS_RATE_DEGRADED, KNOWLEDGE_MISS_RATE_UNHEALTHY, total);

  return {
    component: "clinic_knowledge",
    status,
    metrics: { total, missRate },
    message: describe(status, "Clinic knowledge retrieval"),
  };
}

export function computeOverallStatus(components: ComponentHealth[]): HealthStatus {
  return worstOf(...components.map((component) => component.status));
}
