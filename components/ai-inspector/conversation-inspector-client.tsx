"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, MessagesSquare } from "lucide-react";
import { getConversationTraceAction } from "@/app/actions/analytics";
import { listConversationsAction, type ConversationListItem } from "@/app/actions/ai-inspector";
import { ConversationHealthSummary } from "@/components/ai-inspector/conversation-health-summary";
import { ConversationList } from "@/components/ai-inspector/conversation-list";
import { InspectorSkeleton } from "@/components/ai-inspector/inspector-skeleton";
import { Timeline } from "@/components/ai-inspector/timeline";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { useLocale, useTranslations } from "@/lib/i18n";
import type { ConversationTrace } from "@/lib/observability";
import { cn } from "@/lib/utils";

/**
 * Top-level orchestrator: owns the conversation list fetch
 * (listConversationsAction), the selected conversation, and its trace
 * fetch (getConversationTraceAction, reused as-is from
 * app/actions/analytics.ts -- see that file's own docs on why it's
 * gated the same way). Responsive two-pane layout that collapses to a
 * single column with a back button below the `lg` breakpoint.
 */
export function ConversationInspectorClient({ clinicId }: { clinicId: string }) {
  const t = useTranslations();
  const { locale } = useLocale();

  const [conversations, setConversations] = useState<ConversationListItem[] | null>(null);
  const [listError, setListError] = useState(false);
  const [selected, setSelected] = useState<ConversationListItem | null>(null);
  const [trace, setTrace] = useState<ConversationTrace | null>(null);
  const [traceError, setTraceError] = useState(false);
  const [traceLoading, setTraceLoading] = useState(false);
  const [showDetailOnMobile, setShowDetailOnMobile] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listConversationsAction(clinicId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setListError(true);
        return;
      }
      setListError(false);
      setConversations(result.data);
    });
    return () => {
      cancelled = true;
    };
  }, [clinicId]);

  function loadList() {
    setListError(false);
    listConversationsAction(clinicId).then((result) => {
      if ("error" in result) {
        setListError(true);
        return;
      }
      setConversations(result.data);
    });
  }

  function loadTrace(conversation: ConversationListItem) {
    setTrace(null);
    setTraceError(false);
    setTraceLoading(true);
    getConversationTraceAction(clinicId, conversation.id).then((result) => {
      setTraceLoading(false);
      if ("error" in result) {
        setTraceError(true);
        return;
      }
      setTrace(result.data);
    });
  }

  function handleSelect(conversation: ConversationListItem) {
    setSelected(conversation);
    setShowDetailOnMobile(true);
    loadTrace(conversation);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold">{t.aiInspector.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.aiInspector.description}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <div
          className={cn("overflow-hidden rounded-xl ring-1 ring-foreground/10 lg:block", showDetailOnMobile && "hidden")}
          style={{ height: "min(70vh, 720px)" }}
        >
          <ConversationList
            conversations={conversations}
            error={listError}
            onRetry={loadList}
            selectedId={selected?.id ?? null}
            onSelect={handleSelect}
            t={t}
            locale={locale}
          />
        </div>

        <div className={cn("flex flex-col gap-4", !showDetailOnMobile && "hidden lg:flex")}>
          <Button variant="ghost" size="sm" className="w-fit gap-1.5 lg:hidden" onClick={() => setShowDetailOnMobile(false)}>
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
            {t.aiInspector.detail.back}
          </Button>

          {!selected ? (
            <EmptyState
              icon={MessagesSquare}
              title={t.aiInspector.detail.selectPrompt}
              description={t.aiInspector.detail.selectPromptDescription}
              className="rounded-xl py-16 ring-1 ring-foreground/10"
            />
          ) : traceError ? (
            <ErrorState
              title={t.aiInspector.detail.loadError}
              className="rounded-xl py-16 ring-1 ring-foreground/10"
              action={
                <Button size="sm" variant="outline" onClick={() => loadTrace(selected)}>
                  {t.aiInspector.detail.retry}
                </Button>
              }
            />
          ) : traceLoading || !trace ? (
            <InspectorSkeleton />
          ) : (
            <>
              <ConversationHealthSummary trace={trace} t={t} locale={locale} />
              <Timeline trace={trace} t={t} locale={locale} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
