import { Suspense } from "react";
import { FeatureUsageBeacon } from "@/components/telemetry/feature-usage-beacon";
import { AIActivityFeed, AIActivityFeedSkeleton } from "@/components/dashboard/ai-activity-feed";
import { AIPerformanceStats, AIPerformanceStatsSkeleton } from "@/components/dashboard/ai-performance-stats";
import { AppointmentTimeline, AppointmentTimelineSkeleton } from "@/components/dashboard/appointment-timeline";
import { ClinicStats, ClinicStatsSkeleton } from "@/components/dashboard/clinic-stats";
import { NotificationCenter, NotificationCenterSkeleton } from "@/components/dashboard/notification-center";
import { PatientInsights, PatientInsightsSkeleton } from "@/components/dashboard/patient-insights";
import { QuickActions, QuickActionsSkeleton } from "@/components/dashboard/quick-actions";
import { SystemHealthPanel, SystemHealthPanelSkeleton } from "@/components/dashboard/system-health-panel";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n/server";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

function greeting(now: Date, t: Dictionary) {
  const hour = now.getHours();
  if (hour < 12) return t.dashboard.greetingMorning;
  if (hour < 18) return t.dashboard.greetingAfternoon;
  return t.dashboard.greetingEvening;
}

export default async function ClinicOverviewPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);

  const supabase = await createClient();
  const [{ data: profile }, t, locale] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    getServerDictionary(),
    getServerLocale(),
  ]);
  const firstName = (profile?.full_name || user.email || "").split(" ")[0];

  const now = new Date();
  const today = new Intl.DateTimeFormat(locale === "ar" ? "ar-MA" : locale === "fr" ? "fr-FR" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <div className="flex flex-col gap-8">
      <FeatureUsageBeacon feature="analytics_dashboard" clinicId={clinicId} />
      <div className="flex animate-in flex-col gap-4 fade-in slide-in-from-bottom-1 duration-500 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(now, t)}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {today} · {membership.clinicName}
          </p>
        </div>
        <Suspense fallback={<QuickActionsSkeleton />}>
          <QuickActions clinicId={clinicId} />
        </Suspense>
      </div>

      <section aria-label={t.dashboard.overviewSectionLabel} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
        <Suspense fallback={<ClinicStatsSkeleton />}>
          <ClinicStats clinicId={clinicId} />
        </Suspense>
      </section>

      <section aria-label={t.dashboard.aiPerformanceSectionLabel} className="animate-in fade-in slide-in-from-bottom-1 duration-500">
        <Suspense fallback={<AIPerformanceStatsSkeleton />}>
          <AIPerformanceStats clinicId={clinicId} role={membership.role} />
        </Suspense>
      </section>

      <div className="grid animate-in grid-cols-1 gap-6 fade-in slide-in-from-bottom-1 duration-500 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Suspense fallback={<AppointmentTimelineSkeleton />}>
            <AppointmentTimeline clinicId={clinicId} />
          </Suspense>
          <Suspense fallback={<AIActivityFeedSkeleton />}>
            <AIActivityFeed clinicId={clinicId} />
          </Suspense>
        </div>

        <div className="flex flex-col gap-6">
          <Suspense fallback={<SystemHealthPanelSkeleton />}>
            <SystemHealthPanel clinicId={clinicId} role={membership.role} />
          </Suspense>
          <Suspense fallback={<PatientInsightsSkeleton />}>
            <PatientInsights clinicId={clinicId} role={membership.role} />
          </Suspense>
          <Suspense fallback={<NotificationCenterSkeleton />}>
            <NotificationCenter clinicId={clinicId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
