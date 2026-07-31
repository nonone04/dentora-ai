import { CalendarCheck2, Stethoscope, Users, Wallet } from "lucide-react";
import { StatCard, StatCardSkeleton, StatGrid, type StatDelta } from "@/components/dashboard/stat-card";
import { ErrorState } from "@/components/ui/error-state";
import { getClinicStatsWithTrends, type Trend } from "@/lib/dashboard/trends";
import { formatPercent } from "@/lib/format";
import { getServerDictionary, type Dictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export function ClinicStatsSkeleton() {
  return (
    <StatGrid>
      {Array.from({ length: 4 }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </StatGrid>
  );
}

/** Renders a Trend as a StatCard delta badge -- percent when the previous period was non-zero, a raw signed count otherwise. */
function formatDelta(trend: Trend, t: Dictionary): StatDelta {
  const magnitude = trend.diffPercent != null ? formatPercent(Math.abs(trend.diffPercent)) : Math.abs(trend.diffCount).toLocaleString();
  const sign = trend.diffCount > 0 ? "+" : trend.diffCount < 0 ? "-" : "";
  return { label: `${sign}${magnitude} ${t.dashboard.stats.vsLastWeekSuffix}`, direction: trend.direction };
}

/** Data-only -- kept separate from the component below so a fetch failure never risks being read as a "JSX might throw" case (see the react-hooks/error-boundaries lint rule). */
async function loadClinicStats(clinicId: string) {
  try {
    const supabase = await createClient();
    return await getClinicStatsWithTrends(supabase, clinicId);
  } catch {
    return null;
  }
}

/** Core clinic-operations KPIs -- direct RLS-scoped queries, visible to every clinic role, same tables as the previous Overview page plus real week-over-week trend deltas and 14-day sparklines (see lib/dashboard/trends.ts). */
export async function ClinicStats({ clinicId }: { clinicId: string }) {
  const [stats, t] = await Promise.all([loadClinicStats(clinicId), getServerDictionary()]);
  if (!stats) return <ErrorState title={t.dashboard.clinicStatsError} />;

  return (
    <StatGrid>
      <StatCard
        label={t.dashboard.stats.totalPatients}
        value={stats.patientCount.toLocaleString()}
        numericValue={stats.patientCount}
        icon={Users}
        tone="brand"
        delta={formatDelta(stats.patientTrend, t)}
        sparkline={stats.patientSparkline}
      />
      <StatCard
        label={t.dashboard.stats.activeDentists}
        value={stats.dentistCount.toLocaleString()}
        numericValue={stats.dentistCount}
        icon={Stethoscope}
        tone="info"
      />
      <StatCard
        label={t.dashboard.stats.todaysAppointments}
        value={stats.todayAppointmentCount.toLocaleString()}
        numericValue={stats.todayAppointmentCount}
        icon={CalendarCheck2}
        tone="success"
        delta={formatDelta(stats.appointmentTrend, t)}
        sparkline={stats.appointmentSparkline}
      />
      <StatCard
        label={t.dashboard.stats.monthRevenue}
        value={`${stats.monthRevenue.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${stats.monthRevenue.currency}`}
        numericValue={stats.monthRevenue.total}
        valueSuffix={` ${stats.monthRevenue.currency}`}
        icon={Wallet}
        tone="warning"
        delta={formatDelta(stats.revenueTrend, t)}
        sparkline={stats.revenueSparkline}
      />
    </StatGrid>
  );
}
