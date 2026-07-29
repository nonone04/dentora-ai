"use client";

import { useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { refreshPatientProfileAction } from "@/app/actions/patient-workspace";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRelativeTime } from "@/lib/format";
import { interpolate, type Dictionary, type Locale } from "@/lib/i18n";
import type { PatientProfile } from "@/lib/ai/patient";
import { cn } from "@/lib/utils";

/**
 * Reads lib/ai/patient's own PatientProfile as-is (summary text,
 * summarySource, learned communication/scheduling preferences) --
 * purely presentational, plus a "Refresh" button wired to
 * refreshPatientProfileAction (which just calls the engine's own
 * refreshPatientProfile). The summary text itself is shown verbatim
 * (dir="auto"): it's free-form prose -- LLM-generated when configured,
 * a deterministic template otherwise -- not a dictionary string, so it
 * isn't translated by this UI.
 */
export function AISummaryCard({
  clinicId,
  patientId,
  profile: initialProfile,
  dentistNameById,
  t,
  locale,
}: {
  clinicId: string;
  patientId: string;
  profile: PatientProfile | null;
  dentistNameById: Record<string, string>;
  t: Dictionary;
  locale: Locale;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleRefresh() {
    setPending(true);
    setError(null);
    refreshPatientProfileAction(clinicId, patientId).then((result) => {
      setPending(false);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setProfile(result.profile);
    });
  }

  const preferredDentistName = profile?.scheduling.preferredDentistId ? (dentistNameById[profile.scheduling.preferredDentistId] ?? null) : null;
  const schedulingBits = profile
    ? [
        profile.scheduling.preferredTimeOfDay
          ? interpolate(t.patientDetail.aiSummary.preferredTimeOfDay, { timeOfDay: t.patientDetail.timeOfDay[profile.scheduling.preferredTimeOfDay] })
          : null,
        preferredDentistName ? interpolate(t.patientDetail.aiSummary.preferredDentist, { dentist: preferredDentistName }) : null,
      ].filter((bit): bit is string => bit !== null)
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <Sparkles className="size-4 text-brand" aria-hidden="true" />
          {t.patientDetail.aiSummary.title}
        </CardTitle>
        <CardAction>
          <Button type="button" variant="ghost" size="icon-sm" onClick={handleRefresh} disabled={pending} aria-label={t.patientDetail.aiSummary.refresh}>
            <RefreshCw className={cn("size-4", pending && "animate-spin")} aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3" role="status" aria-live="polite">
        {pending && !profile ? (
          <p className="text-sm text-muted-foreground">{t.patientDetail.aiSummary.refreshing}</p>
        ) : !profile ? (
          <div className="text-sm text-muted-foreground">
            <p>{t.patientDetail.aiSummary.empty}</p>
            <p className="mt-0.5 text-xs">{t.patientDetail.aiSummary.emptyDescription}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-pretty" dir="auto">
              {profile.summary}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="outline">
                {profile.summarySource === "llm" ? t.patientDetail.aiSummary.sourceLlm : t.patientDetail.aiSummary.sourceRuleBased}
              </Badge>
              <span>{interpolate(t.patientDetail.aiSummary.lastUpdated, { time: formatRelativeTime(profile.lastComputedAt, locale) })}</span>
            </div>
            <div className="flex flex-col gap-1 border-t border-border pt-2 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">{t.patientDetail.aiSummary.communicationPreferenceLabel}: </span>
                {profile.communication.preferredChannel
                  ? interpolate(t.patientDetail.aiSummary.communicationPreference, { channel: t.channel[profile.communication.preferredChannel] })
                  : t.patientDetail.aiSummary.noCommunicationPreference}
              </div>
              <div>
                <span className="text-xs text-muted-foreground">{t.patientDetail.aiSummary.schedulingPreferenceLabel}: </span>
                {schedulingBits.length > 0 ? schedulingBits.join(" · ") : t.patientDetail.aiSummary.noSchedulingPreference}
              </div>
            </div>
          </>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
