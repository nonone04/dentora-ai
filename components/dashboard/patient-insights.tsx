import { HeartPulse } from "lucide-react";
import Link from "next/link";
import { getDashboardSummaryAction, getPatientInsightRowsAction } from "@/app/actions/analytics";
import type { ReliabilityLabelValue } from "@/lib/analytics";
import { GlassCard } from "@/components/dashboard/glass-card";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
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

const RELIABILITY_BADGE_TONE: Record<ReliabilityLabelValue, string> = {
  excellent: "bg-success/15 text-success",
  good: "bg-brand/15 text-brand",
  fair: "bg-warning/15 text-warning",
  poor: "bg-destructive/15 text-destructive",
  insufficient_data: "bg-foreground/8 text-muted-foreground",
};

const RELIABILITY_ORDER: ReliabilityLabelValue[] = ["excellent", "good", "fair", "poor", "insufficient_data"];

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

export function PatientInsightsSkeleton() {
  return (
    <GlassCard className="h-full" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-32" />
      </div>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-28 shrink-0 rounded-2xl" />
          ))}
        </div>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </GlassCard>
  );
}

/** Reliability distribution + new-vs-returning split + a "needs a nudge" recall row -- owner/admin only. Bucket data comes from getDashboardSummaryAction (aggregate, no identity); the recall row comes from a separate identity-preserving query (getPatientInsightRowsAction) since the aggregation intentionally discards patient names. */
export async function PatientInsights({ clinicId, role }: { clinicId: string; role: ClinicRole }) {
  const t = await getServerDictionary();

  if (role !== "owner" && role !== "admin") {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.patientInsights.title} />
        <LockedState title={t.dashboard.patientInsights.lockedTitle} description={t.dashboard.patientInsights.lockedDescription} />
      </GlassCard>
    );
  }

  const [summaryResult, rowsResult] = await Promise.all([getDashboardSummaryAction(clinicId), getPatientInsightRowsAction(clinicId, 8)]);

  if ("error" in summaryResult) {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.patientInsights.title} />
        <ErrorState title={t.dashboard.patientInsights.error} description={summaryResult.error} />
      </GlassCard>
    );
  }

  const { patientBehavior } = summaryResult.data;
  const reliabilityLabels = t.dashboard.patientInsights.reliability;
  const recallRows = "data" in rowsResult ? rowsResult.data : [];

  if (patientBehavior.totalPatients === 0) {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.patientInsights.title} />
        <EmptyState icon={HeartPulse} title={t.dashboard.patientInsights.empty} description={t.dashboard.patientInsights.emptyDescription} />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="h-full">
      <SectionHeader
        title={t.dashboard.patientInsights.title}
        description={`${patientBehavior.totalPatients.toLocaleString()} ${t.dashboard.patientInsights.patientsTrackedSuffix}`}
        href={`/clinic/${clinicId}/patients`}
        hrefLabel={t.common.viewAll}
      />
      <CardContent className="flex flex-col gap-5">
        {recallRows.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">{t.dashboard.patientInsights.recallRowTitle}</span>
              <span className="text-[11px] text-muted-foreground">{t.dashboard.patientInsights.recallRowDescription}</span>
            </div>
            <div className="-mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1">
              {recallRows.map((row, index) => (
                <Link
                  key={row.patientId}
                  href={`/clinic/${clinicId}/patients/${row.patientId}`}
                  style={{ animationDelay: `${index * 50}ms`, animationDuration: "450ms", animationFillMode: "backwards" }}
                  className="flex w-32 shrink-0 flex-col items-center gap-1.5 rounded-2xl fade-in slide-in-from-bottom-1 animate-in bg-foreground/[0.03] p-3 text-center ring-1 ring-foreground/8 transition-colors duration-150 hover:bg-foreground/[0.06]"
                >
                  <Avatar size="default" className="ring-1 ring-foreground/10">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-xs text-foreground">
                      {initials(row.fullName)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="w-full truncate text-xs font-medium text-foreground">{row.fullName || t.dashboard.schedule.unknownPatient}</span>
                  <Badge className={`${RELIABILITY_BADGE_TONE[row.reliabilityLabel]} px-1.5 py-0 text-[10px]`}>
                    {reliabilityLabels[row.reliabilityLabel]}
                  </Badge>
                </Link>
              ))}
            </div>
          </div>
        )}

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
        <div className="flex items-center justify-between rounded-xl bg-foreground/[0.03] px-3 py-2 text-sm ring-1 ring-foreground/8">
          <span className="text-muted-foreground">{t.dashboard.patientInsights.newVsReturning}</span>
          <span className="font-medium text-foreground">
            {patientBehavior.newPatients} {t.dashboard.patientInsights.newLabel} · {patientBehavior.returningPatients}{" "}
            {t.dashboard.patientInsights.returningLabel}
          </span>
        </div>
      </CardContent>
    </GlassCard>
  );
}
