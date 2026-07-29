"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Filter, Globe, Search, X } from "lucide-react";
import type { ConversationListItem } from "@/app/actions/ai-inspector";
import { CHANNEL_ICON } from "@/components/ai-inspector/channel-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import { matchesConversationListFilters } from "@/lib/ai-inspector/filters";
import { EMPTY_CONVERSATION_LIST_FILTERS, type ConversationListFilters } from "@/lib/ai-inspector/types";
import { pluralize, type Dictionary, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = ["active", "resolved", "escalated", "abandoned"] as const;
const CHANNEL_OPTIONS = ["whatsapp", "web_chat", "sms"] as const;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  resolved: "outline",
  escalated: "destructive",
  abandoned: "secondary",
};

function ConversationListSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-2" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-lg p-2.5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function ConversationList({
  conversations,
  error,
  onRetry,
  selectedId,
  onSelect,
  t,
  locale,
}: {
  conversations: ConversationListItem[] | null;
  error: boolean;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (conversation: ConversationListItem) => void;
  t: Dictionary;
  locale: Locale;
}) {
  const [filters, setFilters] = useState<ConversationListFilters>(EMPTY_CONVERSATION_LIST_FILTERS);
  const activeFilterCount = filters.statuses.length + filters.channels.length;

  const filtered = useMemo(() => {
    if (!conversations) return [];
    return conversations.filter((conversation) => matchesConversationListFilters(conversation, filters));
  }, [conversations, filters]);

  function toggleStatus(status: string) {
    setFilters((current) => ({
      ...current,
      statuses: current.statuses.includes(status) ? current.statuses.filter((s) => s !== status) : [...current.statuses, status],
    }));
  }
  function toggleChannel(channel: string) {
    setFilters((current) => ({
      ...current,
      channels: current.channels.includes(channel) ? current.channels.filter((c) => c !== channel) : [...current.channels, channel],
    }));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
            <Input
              value={filters.search}
              onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
              placeholder={t.aiInspector.list.searchPlaceholder}
              className="ps-8"
              aria-label={t.aiInspector.list.searchPlaceholder}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label={t.aiInspector.list.filters.label} />}>
              <Filter className="size-4" aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-52">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t.aiInspector.list.filters.status}</DropdownMenuLabel>
                {STATUS_OPTIONS.map((status) => (
                  <DropdownMenuCheckboxItem key={status} checked={filters.statuses.includes(status)} onCheckedChange={() => toggleStatus(status)}>
                    {t.conversationStatus[status]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel>{t.aiInspector.list.filters.channel}</DropdownMenuLabel>
                {CHANNEL_OPTIONS.map((channel) => (
                  <DropdownMenuCheckboxItem key={channel} checked={filters.channels.includes(channel)} onCheckedChange={() => toggleChannel(channel)}>
                    {t.channel[channel]}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              {activeFilterCount > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    type="button"
                    onClick={() => setFilters(EMPTY_CONVERSATION_LIST_FILTERS)}
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                    {t.aiInspector.list.filters.clear}
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {conversations && (
          <p className="text-xs text-muted-foreground">
            {pluralize(filtered.length, t.aiInspector.list.resultCountOne, t.aiInspector.list.resultCountOther)}
          </p>
        )}
      </div>

      <h2 className="sr-only">{t.aiInspector.list.title}</h2>
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <ErrorState
            title={t.aiInspector.list.loadError}
            action={
              <Button size="sm" variant="outline" onClick={onRetry}>
                {t.aiInspector.list.retry}
              </Button>
            }
          />
        ) : !conversations ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <EmptyState title={t.aiInspector.list.empty} description={t.aiInspector.list.emptyDescription} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={AlertTriangle} title={t.aiInspector.list.noResults} description={t.aiInspector.list.noResultsDescription} />
        ) : (
          <ul className="flex flex-col gap-0.5 p-2">
            {filtered.map((conversation) => {
              const ChannelIcon = CHANNEL_ICON[conversation.channel] ?? Globe;
              const isSelected = conversation.id === selectedId;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    aria-current={isSelected}
                    onClick={() => onSelect(conversation)}
                    className={cn(
                      "flex w-full flex-col gap-1 rounded-lg p-2.5 text-start outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected && "bg-muted ring-1 ring-inset ring-border",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{conversation.patientName ?? t.aiInspector.list.unknownPatient}</span>
                      <Badge variant={STATUS_VARIANT[conversation.status] ?? "secondary"} className="shrink-0">
                        {t.conversationStatus[conversation.status as keyof typeof t.conversationStatus] ?? conversation.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <ChannelIcon className="size-3" aria-hidden="true" />
                        {t.channel[conversation.channel as keyof typeof t.channel] ?? conversation.channel}
                      </span>
                      <span>{formatRelativeTime(conversation.startedAt, locale)}</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
