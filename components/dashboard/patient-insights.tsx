import { HeartPulse } from "lucide-react";
import { getDashboardSummaryAction } from "@/app/actions/analytics";
import type { ReliabilityLabelValue } from "@/lib/analytics";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LockedState } from "@/components/ui/locked-state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPercent } from "@/lib/format";
import { getServerDictionary } from "@/lib/i18n/server";
import type { ClinicRole } from "@/lib/supabase/clinic";

const RELIABILITY_TONE: Record<ReliabilityLabelValue, string> = {
  excellent: "bg-success",
  good: "bg-brand",
  fair: "bg-warning",
  poor: "bg-destructive",
  insufficient_data: "bg-muted-foreground",
};

const RELIABILITY_ORDER: ReliabilityLabelValue[] = ["excellent", "good", "fair", "poor", "insufficient_data"];

export function PatientInsightsSkeleton() {
  return (
    <Card className="h-full" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-32" />
      </div>
      <CardContent className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

/** Reliability distribution + new-vs-returning split from patient_profiles -- owner/admin only (bundled into getDashboardSummaryAction alongside AI telemetry). */
export async function PatientInsights({ clinicId, role }: { clinicId: string; role: ClinicRole }) {
  const t = await getServerDictionary();

  if (role !== "owner" && role !== "admin") {
    return (
      <Card className="h-full">
        <SectionHeader title={t.dashboard.patientInsights.title} />
        <LockedState title={t.dashboard.patientInsights.lockedTitle} description={t.dashboard.patientInsights.lockedDescription} />
      </Card>
    );
  }

  const result = await getDashboardSummaryAction(clinicId);
  if ("error" in result) {
    return (
      <Card className="h-full">
        <SectionHeader title={t.dashboard.patientInsights.title} />
        <ErrorState title={t.dashboard.patientInsights.error} description={result.error} />
      </Card>
    );
  }

  const { patientBehavior } = result.data;
  const reliabilityLabels = t.dashboard.patientInsights.reliability;

  if (patientBehavior.totalPatients === 0) {
    return (
      <Card className="h-full">
        <SectionHeader title={t.dashboard.patientInsights.title} />
        <EmptyState icon={HeartPulse} title={t.dashboard.patientInsights.empty} description={t.dashboard.patientInsights.emptyDescription} />
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <SectionHeader
        title={t.dashboard.patientInsights.title}
        description={`${patientBehavior.totalPatients.toLocaleString()} ${t.dashboard.patientInsights.patientsTrackedSuffix}`}
        href={`/clinic/${clinicId}/patients`}
        hrefLabel={t.common.viewAll}
      />
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          {RELIABILITY_ORDER.map((label) => {
            const count = patientBehavior.byReliabilityLabel[label];
            if (count === 0) return null;
            const share = count / patientBehavior.totalPatients;

            return (
              <div key={label} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{reliabilityLabels[label]}</span>
                  <span className="text-muted-foreground">
                    {count} · {formatPercent(share)}
                  </span>
                </div>
                <Progress value={share * 100} indicatorClassName={RELIABILITY_TONE[label]} />
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t.dashboard.patientInsights.newVsReturning}</span>
          <span className="font-medium">
            {patientBehavior.newPatients} {t.dashboard.patientInsights.newLabel} · {patientBehavior.returningPatients}{" "}
            {t.dashboard.patientInsights.returningLabel}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
