import { CheckCircle2Icon, CircleAlertIcon } from "lucide-react";
import { ActiveSessions } from "@/components/account/active-sessions";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { ResendVerificationButton } from "@/components/account/resend-verification-button";
import { FeatureUsageBeacon } from "@/components/telemetry/feature-usage-beacon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMySessions } from "@/lib/auth/sessions";
import type { AccountSecurityEventType } from "@/lib/auth/security-events";
import { formatDateTime } from "@/lib/format";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { getCurrentSessionId, requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

type ActivityRow = {
  id: string;
  event_type: AccountSecurityEventType;
  created_at: string;
};

export default async function AccountSecurityPage() {
  const user = await requireUser();
  const t = await getServerDictionary();
  const locale = await getServerLocale();
  const supabase = await createClient();

  const [sessions, currentSessionId, { data: activityData }] = await Promise.all([
    listMySessions(supabase),
    getCurrentSessionId(),
    supabase
      .from("account_security_events")
      .select("id, event_type, created_at")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const activity = (activityData ?? []) as ActivityRow[];
  const isVerified = !!user.email_confirmed_at;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <FeatureUsageBeacon feature="security" />
      <div>
        <h1 className="text-lg font-semibold">{t.accountSecurity.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.accountSecurity.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.accountSecurity.verification.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            {isVerified ? (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle2Icon className="text-emerald-600" aria-hidden="true" />
                {t.accountSecurity.verification.verifiedLabel}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <CircleAlertIcon aria-hidden="true" />
                {t.accountSecurity.verification.unverifiedLabel}
              </Badge>
            )}
          </div>
          {!isVerified && user.email && <ResendVerificationButton email={user.email} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.accountSecurity.changePassword.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.accountSecurity.sessions.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ActiveSessions initialSessions={sessions} currentSessionId={currentSessionId} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.accountSecurity.lastLogin.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {user.last_sign_in_at ? formatDateTime(user.last_sign_in_at, locale) : t.accountSecurity.lastLogin.never}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.accountSecurity.recentActivity.title}</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.accountSecurity.recentActivity.empty}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {activity.map((event) => (
                <li key={event.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{t.accountSecurity.recentActivity.events[event.event_type]}</span>
                  <span className="text-muted-foreground">{formatDateTime(event.created_at, locale)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.accountSecurity.recommendations.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            {!isVerified && <li>{t.accountSecurity.recommendations.verifyEmail}</li>}
            <li>{t.accountSecurity.recommendations.strongPassword}</li>
            <li>{t.accountSecurity.recommendations.reviewSessions}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
