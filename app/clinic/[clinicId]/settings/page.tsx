import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Globe2, UsersRound } from "lucide-react";
import { AISettingsForm } from "@/components/ai/ai-settings-form";
import { NotificationSettingsForm } from "@/components/clinic/notification-settings-form";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WhatsAppWizard } from "@/components/settings/whatsapp-wizard";
import { FeatureUsageBeacon } from "@/components/telemetry/feature-usage-beacon";
import { getClinicAISettings } from "@/lib/ai/settings";
import { formatDateTime } from "@/lib/format";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { DEFAULT_REMINDER_HOURS_BEFORE, getClinicNotificationSettings } from "@/lib/notifications/settings";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  id: string;
  channel: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  patients: { full_name: string } | null;
};

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const user = await requireUser();
  const membership = await requireClinicMembership(clinicId, user.id);

  if (membership.role !== "owner" && membership.role !== "admin") {
    notFound();
  }

  const supabase = await createClient();
  const [{ data: clinic }, { data: conversationsData }, t, locale] = await Promise.all([
    supabase.from("clinics").select("settings, slug, whatsapp_number, whatsapp_phone_number_id").eq("id", clinicId).single(),
    supabase
      .from("ai_conversations")
      .select("id, channel, status, started_at, ended_at, patients(full_name)")
      .eq("clinic_id", clinicId)
      .order("started_at", { ascending: false })
      .limit(20),
    getServerDictionary(),
    getServerLocale(),
  ]);

  const conversations = (conversationsData ?? []) as unknown as ConversationRow[];
  const notificationSettings = getClinicNotificationSettings(clinic?.settings ?? null);
  const aiSettings = getClinicAISettings(clinic?.settings ?? null);

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const publicChatUrl = clinic?.slug && host ? `${protocol}://${host}/c/${clinic.slug}` : null;

  const conversationStatusLabel = (status: string) => t.conversationStatus[status as keyof typeof t.conversationStatus] ?? status;

  return (
    <div className="flex flex-col gap-6">
      <FeatureUsageBeacon feature="settings" clinicId={clinicId} />
      <div>
        <h1 className="text-lg font-semibold">{t.settings.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.settings.description}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.appearance.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">{t.settings.appearance.description}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <span className="text-sm font-medium">{t.settings.appearance.themeLabel}</span>
              <ThemeToggle variant="labelled" />
            </div>
            <div className="flex items-center justify-between gap-3 sm:justify-start">
              <span className="text-sm font-medium">{t.settings.appearance.languageLabel}</span>
              <LanguageSwitcher variant="labelled" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.notifications.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm
            clinicId={clinicId}
            reminderHoursBefore={notificationSettings.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE}
            sendConfirmations={notificationSettings.sendConfirmations ?? true}
            channelEmail={notificationSettings.channels?.email ?? true}
            channelInApp={notificationSettings.channels?.inApp ?? true}
            categoryAppointmentReminders={notificationSettings.categories?.appointmentReminders ?? true}
            categorySecurityAlerts={notificationSettings.categories?.securityAlerts ?? true}
            categoryAiSummaries={notificationSettings.categories?.aiSummaries ?? true}
            categoryTeamActivity={notificationSettings.categories?.teamActivity ?? true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.settings.whatsappWizard.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsAppWizard
            clinicId={clinicId}
            initialConnected={!!clinic?.whatsapp_phone_number_id}
            initialDisplayNumber={clinic?.whatsapp_number ?? null}
            initialPhoneNumberId={clinic?.whatsapp_phone_number_id ?? null}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <UsersRound className="size-4.5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{t.staffManagement.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t.staffManagement.description}</p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5" nativeButton={false} render={<Link href={`/clinic/${clinicId}/staff`} />}>
            {t.settings.team.manageLink}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <Globe2 className="size-4.5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{t.settings.regional.title}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{t.settings.regional.description}</p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-1.5"
            nativeButton={false}
            render={<Link href={`/clinic/${clinicId}/settings/regional`} />}
          >
            {t.settings.regional.manageLink}
            <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">{t.settings.ai.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.settings.ai.description}</p>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <AISettingsForm
              clinicId={clinicId}
              enabled={aiSettings.enabled ?? false}
              allowedActions={aiSettings.allowedActions ?? []}
            />
            {aiSettings.enabled && publicChatUrl && (
              <div className="border-t border-border pt-4">
                <span className="text-sm font-medium">{t.settings.ai.publicChatLink}</span>
                <p className="mt-1 text-sm text-muted-foreground">{t.settings.ai.publicChatLinkDescription}</p>
                <a href={publicChatUrl} className="mt-1 block break-all text-sm text-primary underline">
                  {publicChatUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground">{t.settings.ai.loggedConversations}</h3>
          {conversations.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">{t.settings.ai.noneYet}</p>
          ) : (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>{t.settings.ai.patient}</TableHead>
                  <TableHead>{t.settings.ai.channel}</TableHead>
                  <TableHead>{t.settings.ai.status}</TableHead>
                  <TableHead>{t.settings.ai.started}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => (
                  <TableRow key={conversation.id}>
                    <TableCell>{conversation.patients?.full_name ?? t.common.dash}</TableCell>
                    <TableCell className="capitalize">{conversation.channel}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{conversationStatusLabel(conversation.status)}</Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(conversation.started_at, locale)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
