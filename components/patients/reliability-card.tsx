import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatPercent } from "@/lib/format";
import { interpolate, type Dictionary } from "@/lib/i18n";
import type { ReliabilityLabel, ReliabilityScore } from "@/lib/ai/patient";
import { cn } from "@/lib/utils";

const TONE_INDICATOR: Record<ReliabilityLabel, string> = {
  excellent: "bg-success",
  good: "bg-brand",
  fair: "bg-warning",
  poor: "bg-destructive",
  insufficient_data: "bg-muted-foreground/40",
};

const TONE_BADGE: Record<ReliabilityLabel, "default" | "secondary" | "destructive" | "outline"> = {
  excellent: "default",
  good: "default",
  fair: "secondary",
  poor: "destructive",
  insufficient_data: "outline",
};

/**
 * Reads lib/ai/patient's own ReliabilityScore as-is (see
 * lib/ai/patient/reliability.ts for the deterministic scoring formula)
 * -- purely presentational. clinicAverageScore, when provided, comes
 * from the existing dashboard analytics action
 * (getDashboardSummaryAction -> patientBehavior.avgReliabilityScore),
 * gated the same owner/admin-only way that action already is.
 */
export function ReliabilityCard({
  reliability,
  clinicAverageScore,
  t,
}: {
  reliability: ReliabilityScore;
  clinicAverageScore?: number | null;
  t: Dictionary;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.patientDetail.reliability.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-2xl font-semibold tabular-nums">{formatPercent(reliability.score)}</span>
          <Badge variant={TONE_BADGE[reliability.label]}>{t.patientDetail.reliabilityLabel[reliability.label]}</Badge>
        </div>
        <Progress value={reliability.score * 100} indicatorClassName={cn(TONE_INDICATOR[reliability.label])} />

        {reliability.label === "insufficient_data" ? (
          <p className="text-sm text-muted-foreground">{t.patientDetail.reliability.insufficientData}</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div>
              <div className="font-semibold tabular-nums">{reliability.completedCount}</div>
              <div className="text-xs text-muted-foreground">{t.patientDetail.reliability.completed}</div>
            </div>
            <div>
              <div className="font-semibold tabular-nums">{reliability.noShowCount}</div>
              <div className="text-xs text-muted-foreground">{t.patientDetail.reliability.noShow}</div>
            </div>
            <div>
              <div className="font-semibold tabular-nums">{reliability.cancelledCount}</div>
              <div className="text-xs text-muted-foreground">{t.patientDetail.reliability.cancelled}</div>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {interpolate(t.patientDetail.reliability.sampleSize, { count: reliability.sampleSize })}
        </p>

        {clinicAverageScore != null && (
          <p className="border-t border-border pt-2 text-xs text-muted-foreground">
            {interpolate(t.patientDetail.reliability.clinicAverage, { value: formatPercent(clinicAverageScore) })}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
