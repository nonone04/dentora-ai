import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { AISettingsForm } from "@/components/ai/ai-settings-form";
import { NotificationSettingsForm } from "@/components/clinic/notification-settings-form";
import { InviteMemberDialog } from "@/components/team/invite-member-dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClinicAISettings } from "@/lib/ai/settings";
import { formatDateTime } from "@/lib/format";
import { DEFAULT_REMINDER_HOURS_BEFORE, getClinicNotificationSettings } from "@/lib/notifications/settings";
import { requireUser } from "@/lib/supabase/auth";
import { requireClinicMembership } from "@/lib/supabase/clinic";
import { createClient } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  role: string;
  is_active: boolean;
  profiles: { full_name: string | null; email: string | null } | null;
};

type AuditLogRow = {
  id: string;
  action: string;
  entity_type: string;
  created_at: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

const AUDIT_ACTION_LABEL: Record<string, string> = {
  appointment_status_changed: "Appointment status changed",
  notification_sent: "Notification sent",
  notification_failed: "Notification failed",
  member_invited: "Member invited",
  member_invitation_accepted: "Invitation accepted",
  appointment_draft_approved: "AI draft approved",
  appointment_draft_rejected: "AI draft rejected",
};

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
  const [{ data: membersData }, { data: clinic }, { data: auditLogsData }, { data: conversationsData }] =
    await Promise.all([
      supabase
        .from("clinic_members")
        .select("id, role, is_active, profiles(full_name, email)")
        .eq("clinic_id", clinicId)
        .order("created_at"),
      supabase.from("clinics").select("settings, slug").eq("id", clinicId).single(),
      supabase
        .from("audit_logs")
        .select("id, action, entity_type, created_at, profiles(full_name, email)")
        .eq("clinic_id", clinicId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("ai_conversations")
        .select("id, channel, status, started_at, ended_at, patients(full_name)")
        .eq("clinic_id", clinicId)
        .order("started_at", { ascending: false })
        .limit(20),
    ]);

  const members = (membersData ?? []) as unknown as MemberRow[];
  const auditLogs = (auditLogsData ?? []) as unknown as AuditLogRow[];
  const conversations = (conversationsData ?? []) as unknown as ConversationRow[];
  const notificationSettings = getClinicNotificationSettings(clinic?.settings ?? null);
  const aiSettings = getClinicAISettings(clinic?.settings ?? null);

  const requestHeaders = await headers();
  const host = requestHeaders.get("host");
  const protocol = host?.startsWith("localhost") ? "http" : "https";
  const publicChatUrl = clinic?.slug && host ? `${protocol}://${host}/c/${clinic.slug}` : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clinic notification preferences and team management.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          <NotificationSettingsForm
            clinicId={clinicId}
            reminderHoursBefore={notificationSettings.reminderHoursBefore ?? DEFAULT_REMINDER_HOURS_BEFORE}
            sendConfirmations={notificationSettings.sendConfirmations ?? true}
          />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Team</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              People with access to this clinic.
            </p>
          </div>
          <InviteMemberDialog clinicId={clinicId} />
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.profiles?.full_name ?? "—"}</TableCell>
                <TableCell>{member.profiles?.email ?? "—"}</TableCell>
                <TableCell className="capitalize">{member.role}</TableCell>
                <TableCell>
                  <Badge variant={member.is_active ? "secondary" : "outline"}>
                    {member.is_active ? "Active" : "Pending"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">Activity log</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Recent notable events for this clinic.
          </p>
        </div>

        {auditLogs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{AUDIT_ACTION_LABEL[log.action] ?? log.action}</TableCell>
                  <TableCell className="capitalize">{log.entity_type}</TableCell>
                  <TableCell>{log.profiles?.full_name ?? log.profiles?.email ?? "System"}</TableCell>
                  <TableCell>{formatDateTime(log.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold">AI assistant</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Patients can chat with this clinic&apos;s AI assistant once enabled below. These
            settings control what it&apos;s allowed to do. Appointments it proposes still need
            staff review in the AI inbox before they&apos;re confirmed.
          </p>
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
                <span className="text-sm font-medium">Public chat link</span>
                <p className="mt-1 text-sm text-muted-foreground">
                  Share this with patients so they can chat with the assistant.
                </p>
                <a href={publicChatUrl} className="mt-1 block break-all text-sm text-primary underline">
                  {publicChatUrl}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div>
          <h3 className="text-sm font-medium text-muted-foreground">Logged conversations</h3>
          {conversations.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">None yet.</p>
          ) : (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversations.map((conversation) => (
                  <TableRow key={conversation.id}>
                    <TableCell>{conversation.patients?.full_name ?? "—"}</TableCell>
                    <TableCell className="capitalize">{conversation.channel}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {conversation.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTime(conversation.started_at)}</TableCell>
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
