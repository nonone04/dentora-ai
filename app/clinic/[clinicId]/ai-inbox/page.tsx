import { DraftActions } from "@/components/ai-inbox/draft-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, serviceName } from "@/lib/format";
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

function patientLabel(draft: DraftRow) {
  return draft.patients?.full_name ?? draft.patient_name ?? draft.patient_phone ?? "Unknown";
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
): string {
  return reasonsByConversationId.get(conversationId) ?? "No reason logged.";
}

export default async function AIInboxPage({
  params,
}: {
  params: Promise<{ clinicId: string }>;
}) {
  const { clinicId } = await params;
  const supabase = await createClient();

  const [{ data: pendingData }, { data: historyData }, { data: escalatedData }] = await Promise.all([
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
      <div>
        <h1 className="text-lg font-semibold">AI inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Appointments proposed by the AI assistant, waiting for staff review.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Pending review</h2>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review right now.</p>
        ) : (
          pending.map((draft) => (
            <Card key={draft.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <div className="font-medium">{patientLabel(draft)}</div>
                  {draft.patient_phone && !draft.patients && (
                    <div className="text-xs text-muted-foreground">{draft.patient_phone}</div>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">
                    {draft.dentists?.full_name ?? "—"} · {serviceName(draft.services?.name_translations)}
                  </div>
                  <div className="mt-1 text-sm">
                    {formatDateTime(draft.proposed_start_at)} – {formatDateTime(draft.proposed_end_at)}
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
        <h2 className="text-base font-semibold">History</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No reviewed drafts yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Dentist</TableHead>
                <TableHead>Proposed</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((draft) => (
                <TableRow key={draft.id}>
                  <TableCell>{patientLabel(draft)}</TableCell>
                  <TableCell>{draft.dentists?.full_name ?? "—"}</TableCell>
                  <TableCell>{formatDateTime(draft.proposed_start_at)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[draft.status] ?? "secondary"} className="capitalize">
                      {draft.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Escalated</h2>
        <p className="text-sm text-muted-foreground">
          Conversations the AI assistant handed off to staff, or couldn&apos;t complete on its own.
        </p>
        {escalated.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing escalated right now.</p>
        ) : (
          escalated.map((conversation) => (
            <Card key={conversation.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <div className="font-medium">{conversation.patients?.full_name ?? "Unknown patient"}</div>
                  <div className="mt-1 text-sm text-muted-foreground capitalize">{conversation.channel}</div>
                  <div className="mt-1 text-sm">
                    {escalationReason(escalationReasonsByConversationId, conversation.id)}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">{formatDateTime(conversation.updated_at)}</div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
