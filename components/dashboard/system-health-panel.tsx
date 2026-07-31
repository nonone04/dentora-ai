import { CheckCircle2, TriangleAlert, XCircle } from "lucide-react";
import { getSystemHealthAction } from "@/app/actions/analytics";
import { GlassCard } from "@/components/dashboard/glass-card";
import { RadialGauge } from "@/components/dashboard/radial-gauge";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LockedState } from "@/components/ui/locked-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { computeHealthScore, primaryHealthMetric } from "@/lib/dashboard/health-score";
import { formatPercent } from "@/lib/format";
import { getServerDictionary, interpolate, type Dictionary } from "@/lib/i18n/server";
import type { ComponentHealth, HealthStatus } from "@/lib/observability";
import type { ClinicRole } from "@/lib/supabase/clinic";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<HealthStatus, typeof CheckCircle2> = {
  healthy: CheckCircle2,
  degraded: TriangleAlert,
  unhealthy: XCircle,
};

const STATUS_BADGE_VARIANT: Record<HealthStatus, "default" | "secondary" | "destructive" | "outline"> = {
  healthy: "outline",
  degraded: "secondary",
  unhealthy: "destructive",
};

const STATUS_DOT: Record<HealthStatus, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  unhealthy: "bg-destructive",
};

const PROGRESS_TONE: Record<HealthStatus, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  unhealthy: "bg-destructive",
};

const METRIC_LABEL_KEY: Record<string, keyof Dictionary["dashboard"]["systemHealth"]["metrics"]> = {
  ai_orchestrator: "avgConfidence",
  notifications: "deliveryRate",
  clinic_knowledge: "hitRate",
};

/** The raw value comes from lib/dashboard/health-score.ts's primaryHealthMetric -- shared with computeHealthScore's radial gauge below, so the per-component rows and the gauge can never silently drift apart. Only the translated label lives here. */
function primaryMetric(component: ComponentHealth, t: Dictionary): { label: string; value: number } | null {
  const value = primaryHealthMetric(component);
  const labelKey = METRIC_LABEL_KEY[component.component];
  if (value === null || !labelKey) return null;
  return { label: t.dashboard.systemHealth.metrics[labelKey], value };
}

function HealthRow({ component, t }: { component: ComponentHealth; t: Dictionary }) {
  const Icon = STATUS_ICON[component.status];
  const metric = primaryMetric(component, t);
  const componentLabels = t.dashboard.systemHealth.components as Record<string, string>;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <span className={cn("size-1.5 rounded-full", STATUS_DOT[component.status])} aria-hidden="true" />
          {componentLabels[component.component] ?? component.component}
        </span>
        <Badge variant={STATUS_BADGE_VARIANT[component.status]} className="gap-1">
          <Icon className="size-3" aria-hidden="true" />
          {t.dashboard.systemHealth.status[component.status]}
        </Badge>
      </div>
      {metric && (
        <div className="flex items-center gap-2">
          <Progress value={metric.value * 100} indicatorClassName={PROGRESS_TONE[component.status]} className="flex-1" />
          <span className="w-20 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
            {metric.label} {formatPercent(metric.value)}
          </span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{component.message}</p>
    </div>
  );
}

export function SystemHealthPanelSkeleton() {
  return (
    <GlassCard className="h-full" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-3 w-20" />
      </div>
      <CardContent className="flex flex-col items-center gap-5">
        <Skeleton className="size-28 rounded-full" />
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex w-full flex-col gap-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-40" />
          </div>
        ))}
      </CardContent>
    </GlassCard>
  );
}

/** AI orchestrator / notification delivery / clinic knowledge health, rolled up into one status -- owner/admin only, matching the underlying ai_* telemetry tables' RLS (see app/actions/analytics.ts). */
export async function SystemHealthPanel({ clinicId, role }: { clinicId: string; role: ClinicRole }) {
  const t = await getServerDictionary();

  if (role !== "owner" && role !== "admin") {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.systemHealth.title} description={t.dashboard.systemHealth.windowLabel} />
        <LockedState title={t.dashboard.systemHealth.lockedTitle} description={t.dashboard.systemHealth.lockedDescription} />
      </GlassCard>
    );
  }

  const result = await getSystemHealthAction(clinicId);
  if ("error" in result) {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.systemHealth.title} description={t.dashboard.systemHealth.windowLabel} />
        <ErrorState title={t.dashboard.systemHealth.error} description={result.error} />
      </GlassCard>
    );
  }

  const health = result.data;
  const score = computeHealthScore(health.components);
  const gaugeTone = score >= 85 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";

  return (
    <GlassCard className="h-full">
      <SectionHeader
        title={t.dashboard.systemHealth.title}
        description={interpolate(t.dashboard.systemHealth.windowSuffix, {
          hours: health.windowHours,
          status: t.dashboard.systemHealth.status[health.status].toLowerCase(),
        })}
      />
      <CardContent className="flex flex-col gap-5" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-1.5 py-1">
          <RadialGauge value={score} toneClassName={gaugeTone}>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">{score}%</span>
            </div>
          </RadialGauge>
          <span className="text-xs font-medium text-muted-foreground">{t.dashboard.systemHealth.healthScoreLabel}</span>
        </div>
        {health.components.map((component) => (
          <HealthRow key={component.component} component={component} t={t} />
        ))}
      </CardContent>
    </GlassCard>
  );
}
