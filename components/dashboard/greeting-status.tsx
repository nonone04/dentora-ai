import { AlertCircle, CalendarCheck2, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getServerDictionary, interpolate } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export function GreetingStatusSkeleton() {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-7 w-40 rounded-full" />
      ))}
    </div>
  );
}

type GreetingStatusData = { aiConversations: number; confirmedAppointments: number; needingAttention: number };

/**
 * Data-only -- kept separate from the component below so a fetch failure
 * never risks being read as a "JSX might throw" case. "Needing attention"
 * counts distinct patients behind today's *escalated* AI conversations --
 * ai_conversations' RLS is member-level (visible to every clinic role, not
 * just owners/admins), unlike patient_profiles' reliability data, so this
 * stays honest without requiring a manager-gated query for a greeting that
 * every role sees.
 */
async function loadGreetingStatus(clinicId: string): Promise<GreetingStatusData | null> {
  try {
    const supabase = await createClient();
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    const [{ count: aiConversations }, { count: confirmedAppointments }, { data: escalated }] = await Promise.all([
      supabase
        .from("ai_conversations")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .gte("created_at", todayStart.toISOString())
        .lt("created_at", todayEnd.toISOString()),
      supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("clinic_id", clinicId)
        .eq("status", "confirmed")
        .gte("start_at", todayStart.toISOString())
        .lt("start_at", todayEnd.toISOString()),
      supabase.from("ai_conversations").select("patient_id").eq("clinic_id", clinicId).eq("status", "escalated"),
    ]);

    const needingAttention = new Set(((escalated ?? []) as { patient_id: string | null }[]).map((c) => c.patient_id).filter(Boolean)).size;

    return { aiConversations: aiConversations ?? 0, confirmedAppointments: confirmedAppointments ?? 0, needingAttention };
  } catch {
    return null;
  }
}

/** Intelligent-greeting status pills -- today's real AI/appointment/attention counts, streamed in independently so a slow query never blocks the h1 above it. Renders nothing on failure rather than an error pill, since this is decorative context, not a widget with its own real estate to fill. */
export async function GreetingStatus({ clinicId }: { clinicId: string }) {
  const [status, t] = await Promise.all([loadGreetingStatus(clinicId), getServerDictionary()]);
  if (!status) return null;

  const gs = t.dashboard.greetingStatus;
  const pills = [
    {
      icon: Sparkles,
      label:
        status.aiConversations === 1
          ? interpolate(gs.aiConversationsOne, { count: status.aiConversations })
          : interpolate(gs.aiConversationsOther, { count: status.aiConversations }),
      tone: "text-violet-700 bg-violet-500/12 ring-violet-500/25 dark:text-violet-200 dark:ring-violet-400/25",
    },
    {
      icon: CalendarCheck2,
      label:
        status.confirmedAppointments === 1
          ? interpolate(gs.appointmentsConfirmedOne, { count: status.confirmedAppointments })
          : interpolate(gs.appointmentsConfirmedOther, { count: status.confirmedAppointments }),
      tone: "text-emerald-700 bg-emerald-500/12 ring-emerald-500/25 dark:text-emerald-200 dark:ring-emerald-400/25",
    },
    {
      icon: AlertCircle,
      label:
        status.needingAttention === 1
          ? interpolate(gs.needsAttentionOne, { count: status.needingAttention })
          : interpolate(gs.needsAttentionOther, { count: status.needingAttention }),
      tone:
        status.needingAttention > 0
          ? "text-amber-700 bg-amber-500/12 ring-amber-500/25 dark:text-amber-200 dark:ring-amber-400/25"
          : "text-muted-foreground bg-foreground/[0.04] ring-foreground/10",
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {pills.map((pill, index) => (
        <span
          key={index}
          style={{ animationDelay: `${index * 70}ms`, animationDuration: "450ms", animationFillMode: "backwards" }}
          className={cn(
            "fade-in slide-in-from-bottom-1 animate-in inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 backdrop-blur-xl",
            pill.tone,
          )}
        >
          <pill.icon className="size-3.5" aria-hidden="true" />
          {pill.label}
        </span>
      ))}
    </div>
  );
}
