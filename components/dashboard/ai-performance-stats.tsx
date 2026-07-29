import { Bot, Send, ShieldAlert, Sparkles } from "lucide-react";
import { getDashboardSummaryAction } from "@/app/actions/analytics";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { LockedState } from "@/components/ui/locked-state";
import { formatPercent } from "@/lib/format";
import { getServerDictionary } from "@/lib/i18n/server";
import type { ClinicRole } from "@/lib/supabase/clinic";

export function AIPerformanceStatsSkeleton() {
  return (
    <StatGrid>
      {Array.from({ length: 4 }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </StatGrid>
  );
}

/** AI resolution + notification delivery KPIs, last 30 days -- owner/admin only (see app/actions/analytics.ts's getDashboardSummaryAction). */
export async function AIPerformanceStats({ clinicId, role }: { clinicId: string; role: ClinicRole }) {
  const t = await getServerDictionary();

  if (role !== "owner" && role !== "admin") {
    return (
      <Card>
        <LockedState title={t.dashboard.aiPerformanceLocked.title} description={t.dashboard.aiPerformanceLocked.description} />
      </Card>
    );
  }

  const result = await getDashboardSummaryAction(clinicId);
  if ("error" in result) {
    return (
      <Card>
        <ErrorState title={t.dashboard.aiPerformanceError} description={result.error} />
      </Card>
    );
  }

  const { aiResolution, notifications } = result.data;

  return (
    <StatGrid>
      <StatCard
        label={t.dashboard.stats.aiAutoResolved}
        value={formatPercent(aiResolution.autoResolvedRate)}
        icon={Sparkles}
        tone="success"
        hint={`${aiResolution.totalDecisions.toLocaleString()} ${t.dashboard.stats.decisionsSuffix}`}
      />
      <StatCard
        label={t.dashboard.stats.escalatedToStaff}
        value={formatPercent(aiResolution.escalationRate)}
        icon={ShieldAlert}
        tone="warning"
      />
      <StatCard label={t.dashboard.stats.aiTurnsHandled} value={aiResolution.totalTurns.toLocaleString()} icon={Bot} tone="brand" />
      <StatCard
        label={t.dashboard.stats.notificationDelivery}
        value={formatPercent(notifications.deliveryRate)}
        icon={Send}
        tone="info"
        hint={`${notifications.total.toLocaleString()} ${t.dashboard.stats.sentSuffix}`}
      />
    </StatGrid>
  );
}
