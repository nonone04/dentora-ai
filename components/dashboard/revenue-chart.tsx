import { AreaChart } from "@/components/dashboard/area-chart";
import { GlassCard } from "@/components/dashboard/glass-card";
import { SectionHeader } from "@/components/dashboard/section-header";
import { CardContent } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/currency";
import { getClinicStatsWithTrends, SPARKLINE_DAYS } from "@/lib/dashboard/trends";
import { formatPercent, INTL_LOCALE } from "@/lib/format";
import { getServerDictionary, getServerLocale, interpolate } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export function RevenueChartSkeleton() {
  return (
    <GlassCard className="h-full" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <CardContent className="flex flex-col gap-4">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </CardContent>
    </GlassCard>
  );
}

/** Data-only -- kept separate from the component below so a fetch failure never risks being read as a "JSX might throw" case (see the react-hooks/error-boundaries lint rule). Independently fetches the same real trend data clinic-stats.tsx uses (not shared via props) so this widget streams in through its own <Suspense> boundary, same convention as ai-performance-stats.tsx / patient-insights.tsx both independently calling getDashboardSummaryAction. */
async function loadRevenueTrend(clinicId: string) {
  try {
    const supabase = await createClient();
    return await getClinicStatsWithTrends(supabase, clinicId);
  } catch {
    return null;
  }
}

/** 14-day revenue trend, drawn from the same real completed-appointment data as the "This month's revenue" KPI card. */
export async function RevenueChart({ clinicId }: { clinicId: string }) {
  const [stats, t, locale] = await Promise.all([loadRevenueTrend(clinicId), getServerDictionary(), getServerLocale()]);
  const localeTag = INTL_LOCALE[locale];

  if (!stats) {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.revenueChart.title} />
        <ErrorState title={t.dashboard.revenueChart.error} />
      </GlassCard>
    );
  }

  const total = stats.revenueSparkline.reduce((sum, v) => sum + v, 0);
  const avgPerDay = total / stats.revenueSparkline.length;
  const { direction, diffPercent, diffCount } = stats.revenueTrend;
  const trendLabel = diffPercent != null ? `${diffCount >= 0 ? "+" : "-"}${formatPercent(Math.abs(diffPercent))}` : null;
  const trendColor = direction === "up" ? "text-success" : direction === "down" ? "text-destructive" : "text-muted-foreground";

  return (
    <GlassCard className="h-full">
      <SectionHeader
        title={t.dashboard.revenueChart.title}
        description={interpolate(t.dashboard.revenueChart.windowSuffix, { days: SPARKLINE_DAYS })}
      />
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(total, stats.monthRevenue.currency, localeTag)}
          </span>
          {trendLabel && (
            <span className={cn("text-xs font-medium", trendColor)}>
              {trendLabel} {t.dashboard.stats.vsLastWeekSuffix}
            </span>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {t.dashboard.revenueChart.avgPerDayPrefix} {formatCurrency(Math.round(avgPerDay), stats.monthRevenue.currency, localeTag)}
          </span>
        </div>
        <AreaChart values={stats.revenueSparkline} toneClassName="text-blue-400" />
      </CardContent>
    </GlassCard>
  );
}
