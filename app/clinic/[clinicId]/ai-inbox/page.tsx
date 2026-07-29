import { DraftActions } from "@/components/ai-inbox/draft-actions";
import { FeatureUsageBeacon } from "@/components/telemetry/feature-usage-beacon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, serviceName } from "@/lib/format";
import { getServerDictionary, getServerLocale, type Dictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type DraftRow = {
  id: string;
  patient_name: string | null;
  patient_phone: string | null;
  proposed_start_at: string;
  proposed_end_at: string;
  status: string;
  notes: string | null;
  dentists: { full_name: string } | null;
  services: { name_translations: Record<string, string> } | null;
  patients: { full_name: string } | null;
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  proposed: "secondary",
  confirmed: "default",
  rejected: "destructive",
  expired: "outline",
};

function patientLabel(draft: DraftRow, t: Dictionary) {
  return draft.patients?.full_name ?? draft.patient_name ?? draft.patient_phone ?? t.aiInbox.unknownPatient;
}

type EscalatedConversationRow = {
  id: string;
  channel: string;
  updated_at: string;
  patients: { full_name: string } | null;
};

function escalationReason(
  reasonsByConversationId: Map<string, string>,
  conversationId: string,
  t: Dictionary,
): string {
  return reasonsByConversationId.get(conversationId) ?? t.aiInbox.noReasonLogged;
}

export default async function AIInboxPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const supabase = await createClient();

  const [{ data: pendingData }, { data: historyData }, { data: escalatedData }, t, locale] = await Promise.all([
    supabase
      .from("appointment_drafts")
      .select(
        "id, patient_name, patient_phone, proposed_start_at, proposed_end_at, status, notes, dentists(full_name), services(name_translations), patients(full_name)",
      )
      .eq("clinic_id", clinicId)
      .eq("status", "proposed")
      .order("proposed_start_at", { ascending: true }),
    supabase
      .from("appointment_drafts")
      .select(
        "id, patient_name, patient_phone, proposed_start_at, proposed_end_at, status, notes, dentists(full_name), services(name_translations), patients(full_name)",
      )
      .eq("clinic_id", clinicId)
      .neq("status", "proposed")
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("ai_conversations")
      .select("id, channel, updated_at, patients(full_name)")
      .eq("clinic_id", clinicId)
      .eq("status", "escalated")
      .order("updated_at", { ascending: false })
      .limit(30),
    getServerDictionary(),
    getServerLocale(),
  ]);

  const pending = (pendingData ?? []) as unknown as DraftRow[];
  const history = (historyData ?? []) as unknown as DraftRow[];
  const escalated = (escalatedData ?? []) as unknown as EscalatedConversationRow[];

  const escalationReasonsByConversationId = new Map<string, string>();
  if (escalated.length > 0) {
    const { data: escalationMessages } = await supabase
      .from("ai_messages")
      .select("conversation_id, metadata, created_at")
      .in(
        "conversation_id",
        escalated.map((conversation) => conversation.id),
      )
      .eq("ai_action", "escalate_to_staff")
      .order("created_at", { ascending: true });

    for (const message of escalationMessages ?? []) {
      // The orchestrator logs every tool call generically as
      // { toolCallId, input, result } -- the reason the model gave
      // lives at input.reason.
      const reason = (message.metadata as { input?: { reason?: string } } | null)?.input?.reason;
      if (reason) escalationReasonsByConversationId.set(message.conversation_id, reason);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <FeatureUsageBeacon feature="ai_inbox" clinicId={clinicId} />
      <div>
        <h1 className="text-lg font-semibold">{t.aiInbox.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.aiInbox.description}</p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.aiInbox.pendingReview}</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.aiInbox.pendingEmpty}</p>
        ) : (
          pending.map((draft) => (
            <Card key={draft.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <div className="font-medium">{patientLabel(draft, t)}</div>
                  {draft.patient_phone && !draft.patients && (
                    <div className="text-xs text-muted-foreground">{draft.patient_phone}</div>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">
                    {draft.dentists?.full_name ?? t.common.dash} · {serviceName(draft.services?.name_translations, locale)}
                  </div>
                  <div className="mt-1 text-sm">
                    {formatDateTime(draft.proposed_start_at, locale)} – {formatDateTime(draft.proposed_end_at, locale)}
                  </div>
                  {draft.notes && <div className="mt-1 text-sm text-muted-foreground">{draft.notes}</div>}
                </div>
                <DraftActions clinicId={clinicId} draftId={draft.id} />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.aiInbox.history}</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.aiInbox.historyEmpty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.aiInbox.patient}</TableHead>
                <TableHead>{t.aiInbox.dentist}</TableHead>
                <TableHead>{t.aiInbox.proposed}</TableHead>
                <TableHead>{t.aiInbox.status}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((draft) => (
                <TableRow key={draft.id}>
                  <TableCell>{patientLabel(draft, t)}</TableCell>
                  <TableCell>{draft.dentists?.full_name ?? t.common.dash}</TableCell>
                  <TableCell>{formatDateTime(draft.proposed_start_at, locale)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[draft.status] ?? "secondary"}>
                      {t.draftStatus[draft.status as keyof typeof t.draftStatus] ?? draft.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.aiInbox.escalated}</h2>
        <p className="text-sm text-muted-foreground">{t.aiInbox.escalatedDescription}</p>
        {escalated.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.aiInbox.escalatedEmpty}</p>
        ) : (
          escalated.map((conversation) => (
            <Card key={conversation.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <div className="font-medium">{conversation.patients?.full_name ?? t.aiInbox.unknownPatient}</div>
                  <div className="mt-1 text-sm text-muted-foreground capitalize">{conversation.channel}</div>
                  <div className="mt-1 text-sm">
                    {escalationReason(escalationReasonsByConversationId, conversation.id, t)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(conversation.updated_at, locale)}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
