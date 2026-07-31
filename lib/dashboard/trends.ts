import type { SupabaseClient } from "@supabase/supabase-js";

const DAY_MS = 24 * 60 * 60 * 1000;
export const SPARKLINE_DAYS = 14;

export type TrendDirection = "up" | "down" | "flat";
export type Trend = { direction: TrendDirection; diffCount: number; diffPercent: number | null };

function utcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Pure: current vs previous -> direction + both an absolute and a relative diff (relative is null when previous is 0, since a percentage off zero is undefined, not infinite). */
export function computeTrend(current: number, previous: number): Trend {
  const diffCount = current - previous;
  const direction: TrendDirection = diffCount > 0 ? "up" : diffCount < 0 ? "down" : "flat";
  const diffPercent = previous === 0 ? null : diffCount / previous;
  return { direction, diffCount, diffPercent };
}

/**
 * Groups ISO timestamps into `days` daily buckets, oldest first, ending
 * (exclusively) at `endExclusive`'s UTC day. A timestamp outside the
 * window is silently dropped -- callers already scope their query to the
 * same window, so this only matters for boundary timestamps.
 */
export function bucketCountsByDay(isoDates: string[], days: number, endExclusive: Date): number[] {
  const buckets = new Array(days).fill(0) as number[];
  const windowStart = utcDayStart(endExclusive).getTime() - days * DAY_MS;

  for (const iso of isoDates) {
    const dayIndex = Math.floor((utcDayStart(new Date(iso)).getTime() - windowStart) / DAY_MS);
    if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex] += 1;
  }

  return buckets;
}

/** Same bucketing as bucketCountsByDay, summing `amount` per day instead of counting rows. */
export function bucketAmountsByDay(rows: { date: string; amount: number }[], days: number, endExclusive: Date): number[] {
  const buckets = new Array(days).fill(0) as number[];
  const windowStart = utcDayStart(endExclusive).getTime() - days * DAY_MS;

  for (const row of rows) {
    const dayIndex = Math.floor((utcDayStart(new Date(row.date)).getTime() - windowStart) / DAY_MS);
    if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex] += row.amount;
  }

  return buckets;
}

/** Sums the trailing and preceding halves of a bucket array into a Trend -- e.g. for a 14-entry array, the last 7 days vs the 7 before that. */
export function trendFromBuckets(buckets: number[]): Trend {
  const half = Math.floor(buckets.length / 2);
  const previous = buckets.slice(0, half).reduce((sum, v) => sum + v, 0);
  const current = buckets.slice(half).reduce((sum, v) => sum + v, 0);
  return computeTrend(current, previous);
}

type RevenueRow = { services: { price: number | string | null; currency: string } | null };

function servicePrice(row: RevenueRow): number {
  const price = row.services?.price;
  return price == null ? 0 : Number(price);
}

export type ClinicStatsTrendData = {
  patientCount: number;
  patientTrend: Trend;
  patientSparkline: number[];
  dentistCount: number;
  todayAppointmentCount: number;
  appointmentTrend: Trend;
  appointmentSparkline: number[];
  monthRevenue: { total: number; currency: string };
  revenueTrend: Trend;
  revenueSparkline: number[];
};

/**
 * Extends clinic-stats.tsx's original loadClinicStats with real
 * week-over-week trend deltas and 14-day sparkline series -- no new
 * tables, no new RLS policies (every read here is already scoped by
 * clinic_id the same way the original queries were). Dentist headcount
 * intentionally has no trend/sparkline: staffing counts don't move on a
 * daily cadence, so a 14-day chart of it would be empty or misleading
 * rather than informative.
 *
 * The single 14-day appointments window doubles as the source for both
 * today's appointment count (filtered client-side, same as before) and
 * the sparkline/trend data, instead of firing a separate "today" query.
 */
export async function getClinicStatsWithTrends(
  supabase: SupabaseClient,
  clinicId: string,
  now: Date = new Date(),
): Promise<ClinicStatsTrendData> {
  const todayStart = utcDayStart(now);
  const todayEnd = new Date(todayStart.getTime() + DAY_MS);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const windowStart = new Date(todayEnd.getTime() - SPARKLINE_DAYS * DAY_MS);

  const [{ count: patientCount }, { count: dentistCount }, { data: recentPatients }, { data: windowAppointments }, { data: monthAppointments }] =
    await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId),
      supabase.from("dentists").select("*", { count: "exact", head: true }).eq("clinic_id", clinicId).eq("is_active", true),
      supabase.from("patients").select("created_at").eq("clinic_id", clinicId).gte("created_at", windowStart.toISOString()),
      supabase
        .from("appointments")
        .select("start_at, status, services(price, currency)")
        .eq("clinic_id", clinicId)
        .gte("start_at", windowStart.toISOString())
        .lt("start_at", todayEnd.toISOString()),
      supabase
        .from("appointments")
        .select("id, services(price, currency)")
        .eq("clinic_id", clinicId)
        .eq("status", "completed")
        .gte("start_at", monthStart.toISOString())
        .lt("start_at", monthEnd.toISOString()),
    ]);

  const patients = (recentPatients ?? []) as { created_at: string }[];
  const appointments = (windowAppointments ?? []) as unknown as { start_at: string; status: string; services: RevenueRow["services"] }[];
  const monthRows = (monthAppointments ?? []) as unknown as RevenueRow[];

  const todayAppointmentCount = appointments.filter(
    (a) => a.status !== "cancelled" && a.start_at >= todayStart.toISOString() && a.start_at < todayEnd.toISOString(),
  ).length;

  const patientSparkline = bucketCountsByDay(
    patients.map((p) => p.created_at),
    SPARKLINE_DAYS,
    todayEnd,
  );

  const appointmentSparkline = bucketCountsByDay(
    appointments.filter((a) => a.status !== "cancelled").map((a) => a.start_at),
    SPARKLINE_DAYS,
    todayEnd,
  );

  const revenueSparkline = bucketAmountsByDay(
    appointments
      .filter((a) => a.status === "completed")
      .map((a) => ({ date: a.start_at, amount: servicePrice(a) })),
    SPARKLINE_DAYS,
    todayEnd,
  );

  let monthRevenueTotal = 0;
  let currency = "MAD";
  for (const row of monthRows) {
    monthRevenueTotal += servicePrice(row);
    if (row.services?.currency) currency = row.services.currency;
  }

  return {
    patientCount: patientCount ?? 0,
    patientTrend: trendFromBuckets(patientSparkline),
    patientSparkline,
    dentistCount: dentistCount ?? 0,
    todayAppointmentCount,
    appointmentTrend: trendFromBuckets(appointmentSparkline),
    appointmentSparkline,
    monthRevenue: { total: monthRevenueTotal, currency },
    revenueTrend: trendFromBuckets(revenueSparkline),
    revenueSparkline,
  };
}
