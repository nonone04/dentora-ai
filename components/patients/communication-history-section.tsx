"use client";

import { useState } from "react";
import { ChevronDown, MessagesSquare } from "lucide-react";
import { getConversationTraceAction } from "@/app/actions/analytics";
import { CHANNEL_ICON } from "@/components/ai-inspector/channel-icon";
import { ConversationHealthSummary } from "@/components/ai-inspector/conversation-health-summary";
import { Timeline } from "@/components/ai-inspector/timeline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { LockedState } from "@/components/ui/locked-state";
import { formatDateTime } from "@/lib/format";
import { pluralize, type Dictionary, type Locale } from "@/lib/i18n";
import type { ConversationTrace } from "@/lib/observability";
import type { ClinicRole } from "@/lib/supabase/clinic";
import { cn } from "@/lib/utils";

export type PatientConversationRow = {
  id: string;
  channel: string;
  status: string;
  started_at: string;
  ended_at: string | null;
  messageCount: number;
};

/**
 * Expandable per-conversation trace, reusing components/ai-inspector's
 * own Timeline + ConversationHealthSummary wholesale via the same
 * getConversationTraceAction (app/actions/analytics.ts) the AI
 * Inspector page itself calls -- no trace-rendering logic duplicated
 * here. Fetched lazily on first expand, cached after that.
 */
function ConversationCard({
  clinicId,
  conversation,
  canViewTrace,
  t,
  locale,
}: {
  clinicId: string;
  conversation: PatientConversationRow;
  canViewTrace: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  const [expanded, setExpanded] = useState(false);
  const [trace, setTrace] = useState<ConversationTrace | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const ChannelIcon = CHANNEL_ICON[conversation.channel] ?? MessagesSquare;

  function loadTrace() {
    setLoading(true);
    setError(false);
    getConversationTraceAction(clinicId, conversation.id).then((result) => {
      setLoading(false);
      if ("error" in result) {
        setError(true);
        return;
      }
      setTrace(result.data);
    });
  }

  function toggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && canViewTrace && !trace && !loading && !error) {
      loadTrace();
    }
  }

  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-2 p-3 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ChannelIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-medium">{t.channel[conversation.channel as keyof typeof t.channel] ?? conversation.channel}</span>
              <Badge variant="outline">{t.conversationStatus[conversation.status as keyof typeof t.conversationStatus] ?? conversation.status}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDateTime(conversation.started_at, locale)} ·{" "}
              {pluralize(conversation.messageCount, t.patientDetail.communicationHistory.messageCountOne, t.patientDetail.communicationHistory.messageCountOther)}
            </div>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
          {expanded ? t.patientDetail.communicationHistory.hideTrace : t.patientDetail.communicationHistory.viewTrace}
          <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border p-3">
          {!canViewTrace ? (
            <LockedState
              title={t.patientDetail.communicationHistory.traceLockedTitle}
              description={t.patientDetail.communicationHistory.traceLockedDescription}
            />
          ) : loading ? (
            <p className="p-2 text-sm text-muted-foreground">{t.patientDetail.communicationHistory.traceLoading}</p>
          ) : error ? (
            <ErrorState
              title={t.patientDetail.communicationHistory.traceLoadError}
              action={
                <Button size="sm" variant="outline" onClick={loadTrace}>
                  {t.patientDetail.communicationHistory.retry}
                </Button>
              }
            />
          ) : trace ? (
            <div className="flex flex-col gap-3">
              <ConversationHealthSummary trace={trace} t={t} locale={locale} />
              <Timeline trace={trace} t={t} locale={locale} />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function CommunicationHistorySection({
  clinicId,
  conversations,
  role,
  t,
  locale,
}: {
  clinicId: string;
  conversations: PatientConversationRow[];
  role: ClinicRole;
  t: Dictionary;
  locale: Locale;
}) {
  const canViewTrace = role === "owner" || role === "admin";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.patientDetail.communicationHistory.title}</CardTitle>
      </CardHeader>
      <CardContent>
        {conversations.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title={t.patientDetail.communicationHistory.empty}
            description={t.patientDetail.communicationHistory.emptyDescription}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {conversations.map((conversation) => (
              <ConversationCard key={conversation.id} clinicId={clinicId} conversation={conversation} canViewTrace={canViewTrace} t={t} locale={locale} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
