import { Activity, CalendarCheck2, FlaskConical, Gauge, Sparkles, Users } from "lucide-react";
import { StatCard, StatGrid } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/telemetry/admin-access";
import { getTelemetryDashboardSummary } from "@/lib/telemetry/dashboard";
import type { AnalyticsEventName, FeatureName } from "@/lib/telemetry/events";

function percentFormatter(locale: string) {
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
}

/** A single magnitude bar: one hue (bg-primary) on a bg-muted track, with a direct numeric label -- no legend needed for a single series. */
function MagnitudeBar({ label, value, share }: { label: string; value: number; share: number }) {
  const width = Math.max(0, Math.min(1, share)) * 100;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-foreground">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  await requirePlatformAdmin();

  const [t, locale] = await Promise.all([getServerDictionary(), getServerLocale()]);
  const admin = createAdminClient();
  const summary = await getTelemetryDashboardSummary(admin);
  const percent = percentFormatter(locale);

  const featureLabels: Record<FeatureName, string> = {
    calendar: t.nav.calendar,
    patient_profile: t.adminAnalytics.features.patient_profile,
    analytics_dashboard: t.adminAnalytics.features.analytics_dashboard,
    staff_management: t.nav.staff,
    security: t.adminAnalytics.features.security,
    settings: t.nav.settings,
    ai_inbox: t.nav.aiInbox,
  };

  const funnelLabels: Partial<Record<AnalyticsEventName, string>> = {
    "User Registered": t.adminAnalytics.funnelSteps.userRegistered,
    "Email Verified": t.adminAnalytics.funnelSteps.emailVerified,
    "Clinic Created": t.adminAnalytics.funnelSteps.clinicCreated,
    "Staff Invited": t.adminAnalytics.funnelSteps.staffInvited,
    "CSV Import Completed": t.adminAnalytics.funnelSteps.csvImportCompleted,
    "WhatsApp Connected": t.adminAnalytics.funnelSteps.whatsappConnected,
    "Appointment Created": t.adminAnalytics.funnelSteps.appointmentCreated,
    "AI Conversation Started": t.adminAnalytics.funnelSteps.aiConversationStarted,
  };

  const maxFeatureUsers = Math.max(1, ...summary.featureAdoption.map((f) => f.clinics));
  const maxFunnelClinics = Math.max(1, ...summary.onboardingFunnel.map((s) => s.clinics));
  const maxFeatureUseCount = Math.max(1, ...summary.mostUsedFeatures.map((f) => f.count));

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.adminAnalytics.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.adminAnalytics.description}</p>
      </div>

      <section>
        <StatGrid>
          <StatCard label={t.adminAnalytics.activeUsers.daily} value={String(summary.activeUsers.daily)} icon={Users} tone="brand" />
          <StatCard label={t.adminAnalytics.activeUsers.weekly} value={String(summary.activeUsers.weekly)} icon={Users} tone="info" />
          <StatCard label={t.adminAnalytics.activeUsers.monthly} value={String(summary.activeUsers.monthly)} icon={Users} tone="default" />
          <StatCard
            label={t.adminAnalytics.activation.title}
            value={percent.format(summary.activation.rate)}
            icon={Gauge}
            tone="success"
            hint={t.adminAnalytics.activation.hint}
          />
        </StatGrid>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-muted-foreground" aria-hidden="true" />
              {t.adminAnalytics.featureAdoption.title}
            </CardTitle>
            <p className="text-xs text-muted-foreground">{t.adminAnalytics.featureAdoption.hint}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {summary.featureAdoption.map((entry) => (
              <MagnitudeBar
                key={entry.feature}
                label={featureLabels[entry.feature]}
                value={entry.clinics}
                share={entry.clinics / maxFeatureUsers}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" aria-hidden="true" />
              {t.adminAnalytics.mostUsedFeatures.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {summary.mostUsedFeatures.length === 0 && <p className="text-sm text-muted-foreground">{t.common.none}</p>}
            {summary.mostUsedFeatures.map((entry) => (
              <MagnitudeBar
                key={entry.feature}
                label={featureLabels[entry.feature]}
                value={entry.count}
                share={entry.count / maxFeatureUseCount}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="size-4 text-muted-foreground" aria-hidden="true" />
            {t.adminAnalytics.onboardingFunnel.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {summary.onboardingFunnel.map((step) => (
            <MagnitudeBar
              key={step.step}
              label={funnelLabels[step.step] ?? step.step}
              value={step.clinics}
              share={step.clinics / maxFunnelClinics}
            />
          ))}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <StatGrid className="sm:col-span-2 sm:grid-cols-2">
          <StatCard label={t.adminAnalytics.demoUsage.started} value={String(summary.demoUsage.started)} icon={FlaskConical} tone="info" />
          <StatCard label={t.adminAnalytics.demoUsage.reset} value={String(summary.demoUsage.reset)} icon={FlaskConical} tone="default" />
        </StatGrid>

        <Card className="sm:col-span-2">
          <CardHeader>
            <CardTitle>{t.adminAnalytics.trialConversion.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.trialConversion.status === "insufficient_data" ? (
              <p className="text-sm text-muted-foreground">{t.adminAnalytics.trialConversion.insufficientData}</p>
            ) : (
              <p className="text-sm text-foreground">
                {percent.format(summary.trialConversion.rate)} — {t.adminAnalytics.trialConversion.rate}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
