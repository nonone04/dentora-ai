import type { ComponentHealth, HealthStatus } from "@/lib/observability";

/**
 * Each component's single headline metric, as a 0-1 rate. Hoisted out of
 * components/dashboard/system-health-panel.tsx (which used to compute this
 * inline) so the radial gauge in computeHealthScore below and the panel's
 * per-component rows share one source of truth instead of two independent
 * formulas that could silently drift apart.
 */
export function primaryHealthMetric(component: ComponentHealth): number | null {
  if (component.component === "ai_orchestrator") return component.metrics.avgConfidence ?? null;
  if (component.component === "notifications") return component.metrics.deliveryRate ?? null;
  if (component.component === "clinic_knowledge") return 1 - (component.metrics.missRate ?? 0);
  return null;
}

/**
 * Each status's score band -- the gauge must never contradict a
 * component's own "Healthy"/"Degraded"/"Unhealthy" badge, so status
 * decides which band a component falls in, and its primary metric (when
 * present) only fine-tunes where within that band. This matters because
 * lib/observability/health/thresholds.ts's MIN_SAMPLE_SIZE guard reports
 * "healthy" (not a low score) when there's too little data to judge a
 * rate -- e.g. 0% AI confidence with zero conversations logged is
 * "healthy" (inconclusive), not "unhealthy". A naive average of raw
 * metrics would score that 0%, flatly contradicting the "Healthy" badge
 * right next to it.
 */
const STATUS_BAND: Record<HealthStatus, [low: number, high: number]> = {
  healthy: [0.85, 1],
  degraded: [0.5, 0.85],
  unhealthy: [0.2, 0.5],
};

/**
 * 0-100 composite "clinic health" score for the dashboard's radial gauge.
 * This is a new interpretive choice, not a value lib/observability already
 * emits (getSystemHealth only returns a worst-of HealthStatus string, see
 * computeOverallStatus) -- see STATUS_BAND above for why it's status-first
 * rather than a plain average of raw metrics.
 */
export function computeHealthScore(components: ComponentHealth[]): number {
  if (components.length === 0) return 100;

  const scores = components.map((component) => {
    const [low, high] = STATUS_BAND[component.status];
    const metric = primaryHealthMetric(component);
    if (metric === null) return (low + high) / 2;
    return low + Math.max(0, Math.min(1, metric)) * (high - low);
  });

  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average * 100);
}
