import { Bot, MessageCircle, MessageSquare, Smartphone, Sparkles } from "lucide-react";
import { GlassCard } from "@/components/dashboard/glass-card";
import { SectionHeader } from "@/components/dashboard/section-header";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/format";
import { getServerDictionary, getServerLocale } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

type ConversationRow = {
  id: string;
  channel: string;
  status: string;
  updated_at: string;
  patients: { full_name: string } | null;
};

type MessageRow = { conversation_id: string; role: string; content: string; created_at: string };

const CHANNEL_ICON: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  web_chat: MessageSquare,
  sms: Smartphone,
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "secondary",
  resolved: "outline",
  escalated: "destructive",
  abandoned: "outline",
};

export function AIActivityFeedSkeleton() {
  return (
    <GlassCard className="h-full" aria-hidden="true">
      <div className="flex flex-col gap-1.5 border-b p-(--card-spacing)">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <CardContent className="flex flex-col gap-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-8 w-full rounded-2xl" />
            </div>
          </div>
        ))}
      </CardContent>
    </GlassCard>
  );
}

type AIActivityData = { conversations: ConversationRow[]; lastMessageByConversation: Map<string, MessageRow> };

/** Data-only -- kept separate from the component below so a fetch failure never risks being read as a "JSX might throw" case (see the react-hooks/error-boundaries lint rule). */
async function loadRecentConversations(clinicId: string): Promise<AIActivityData | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("id, channel, status, updated_at, patients(full_name)")
      .eq("clinic_id", clinicId)
      .order("updated_at", { ascending: false })
      .limit(6);

    if (error) throw error;
    const conversations = (data ?? []) as unknown as ConversationRow[];

    const lastMessageByConversation = new Map<string, MessageRow>();
    if (conversations.length > 0) {
      const { data: messages, error: messagesError } = await supabase
        .from("ai_messages")
        .select("conversation_id, role, content, created_at")
        .in(
          "conversation_id",
          conversations.map((c) => c.id),
        )
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;
      for (const message of (messages ?? []) as MessageRow[]) {
        lastMessageByConversation.set(message.conversation_id, message);
      }
    }

    return { conversations, lastMessageByConversation };
  } catch {
    return null;
  }
}

/** Recent AI conversations across every channel -- ai_conversations' RLS is member-level, so every clinic role sees this, not just owners/admins. */
export async function AIActivityFeed({ clinicId }: { clinicId: string }) {
  const [activity, t, locale] = await Promise.all([loadRecentConversations(clinicId), getServerDictionary(), getServerLocale()]);

  if (activity === null) {
    return (
      <GlassCard className="h-full">
        <SectionHeader title={t.dashboard.aiActivity.title} />
        <ErrorState title={t.dashboard.aiActivity.error} />
      </GlassCard>
    );
  }

  const { conversations, lastMessageByConversation } = activity;
  const channelLabels: Record<string, string> = { whatsapp: t.channel.whatsapp, web_chat: t.channel.web_chat, sms: t.channel.sms };

  return (
    <GlassCard className="h-full">
      <SectionHeader
        title={t.dashboard.aiActivity.title}
        description={t.dashboard.aiActivity.description}
        href={`/clinic/${clinicId}/ai-inbox`}
        hrefLabel={t.common.viewAll}
      />
      <CardContent>
        {conversations.length === 0 ? (
          <EmptyState icon={Sparkles} title={t.dashboard.aiActivity.empty} description={t.dashboard.aiActivity.emptyDescription} />
        ) : (
          <ul className="flex flex-col gap-3">
            {conversations.map((conversation, index) => {
              const Icon = CHANNEL_ICON[conversation.channel] ?? Bot;
              const lastMessage = lastMessageByConversation.get(conversation.id);

              return (
                <li
                  key={conversation.id}
                  style={{ animationDelay: `${index * 60}ms`, animationDuration: "450ms", animationFillMode: "backwards" }}
                  className="flex items-start gap-3 rounded-xl fade-in slide-in-from-bottom-1 -mx-2 animate-in p-2 transition-colors duration-150 hover:bg-foreground/[0.03]"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/25 to-violet-500/25 text-blue-300 ring-1 ring-foreground/10">
                    <Icon className="size-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">
                        {conversation.patients?.full_name ?? t.dashboard.aiActivity.unknownPatient}
                      </span>
                      <Badge variant={STATUS_VARIANT[conversation.status] ?? "secondary"} className="shrink-0">
                        {t.conversationStatus[conversation.status as keyof typeof t.conversationStatus] ?? conversation.status}
                      </Badge>
                    </div>
                    <p className="mt-1.5 truncate rounded-2xl rounded-tl-sm bg-foreground/[0.04] px-3 py-1.5 text-xs text-muted-foreground ring-1 ring-foreground/5">
                      {lastMessage ? lastMessage.content : t.dashboard.aiActivity.noMessages}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {channelLabels[conversation.channel] ?? conversation.channel} · {formatRelativeTime(conversation.updated_at, locale)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </GlassCard>
  );
}
