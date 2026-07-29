import { CalendarCheck2, Stethoscope, Users, Wallet } from "lucide-react";
import { StatCard, StatCardSkeleton, StatGrid } from "@/components/dashboard/stat-card";
import { ErrorState } from "@/components/ui/error-state";
import { getServerDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type RevenueRow = { services: { price: number | string | null; currency: string } | null };

function sumRevenue(rows: RevenueRow[]) {
  let total = 0;
  let currency = "MAD";
  for (const row of rows) {
    const price = row.services?.price;
    if (price != null) {
      total += Number(price);
      currency = row.services?.currency ?? currency;
    }
  }
  return { total, currency };
}

export function ClinicStatsSkeleton() {
  return (
    <StatGrid>
      {Array.from({ length: 4 }, (_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </StatGrid>
  );
}

type ClinicStatsData = {
  patientCount: number;
  dentistCount: number;
  todayAppointmentCount: number;
  monthRevenue: { total: number; currency: string };
};

/** Data-only -- kept separate from the component below so a fetch failure never risks being read as a "JSX might throw" case (see the react-hooks/error-boundaries lint rule). */
async function loadClinicStats(clinicId: string): Promise<ClinicStatsData | null> {
  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [{ count: patientCount }, { count: dentistCount }, { data: todayData }, { data: monthData }] = await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("dentists").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("is_active", true),
      supabase
        .from("appointments")
        .select("id, status")
        .eq("clinic_id", clinicId)
        .gte("start_at", todayStart.toISOString())
        .lt("start_at", todayEnd.toISOString()),
      supabase
        .from("appointments")
        .select("id, services(price, currency)")
        .eq("clinic_id", clinicId)
        .eq("status", "completed")
        .gte("start_at", monthStart.toISOString())
        .lt("start_at", monthEnd.toISOString()),
    ]);

    const todayAppointments = (todayData ?? []) as { id: string; status: string }[];
    const monthAppointments = (monthData ?? []) as unknown as RevenueRow[];

    return {
      patientCount: patientCount ?? 0,
      dentistCount: dentistCount ?? 0,
      todayAppointmentCount: todayAppointments.filter((a) => a.status !== "cancelled").length,
      monthRevenue: sumRevenue(monthAppointments),
    };
  } catch {
    return null;
  }
}

/** Core clinic-operations KPIs -- direct RLS-scoped queries, visible to every clinic role, same tables/shape as the previous Overview page. */
export async function ClinicStats({ clinicId }: { clinicId: string }) {
  const [stats, t] = await Promise.all([loadClinicStats(clinicId), getServerDictionary()]);
  if (!stats) return <ErrorState title={t.dashboard.clinicStatsError} />;

  return (
    <StatGrid>
      <StatCard label={t.dashboard.stats.totalPatients} value={stats.patientCount.toLocaleString()} icon={Users} tone="brand" />
      <StatCard label={t.dashboard.stats.activeDentists} value={stats.dentistCount.toLocaleString()} icon={Stethoscope} tone="info" />
      <StatCard
        label={t.dashboard.stats.todaysAppointments}
        value={stats.todayAppointmentCount.toLocaleString()}
        icon={CalendarCheck2}
        tone="success"
      />
      <StatCard
        label={t.dashboard.stats.monthRevenue}
        value={`${stats.monthRevenue.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${stats.monthRevenue.currency}`}
        icon={Wallet}
        tone="warning"
      />
    </StatGrid>
  );
}
