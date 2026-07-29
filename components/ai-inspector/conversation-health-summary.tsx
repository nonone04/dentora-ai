"use client";

import { useMemo } from "react";
import { AlertCircle, AlertTriangle, Clock, Gauge, Languages, ListChecks, Timer } from "lucide-react";
import { CHANNEL_ICON } from "@/components/ai-inspector/channel-icon";
import { StatCard, StatGrid, type StatTone } from "@/components/dashboard/stat-card";
import { computeConversationHealth } from "@/lib/ai-inspector/health";
import { confidenceTone } from "@/lib/ai-inspector/step-meta";
import { formatDuration, formatPercent } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { ConversationTrace } from "@/lib/observability";

const CONFIDENCE_TONE: Record<ReturnType<typeof confidenceTone>, StatTone> = {
  high: "success",
  medium: "warning",
  low: "destructive",
};

/** Pure UI rollup of an already-fetched ConversationTrace -- reuses computeConversationHealth (lib/ai-inspector/health.ts) rather than re-deriving anything from lib/observability itself. */
export function ConversationHealthSummary({ trace, t, locale }: { trace: ConversationTrace; t: Dictionary; locale: Locale }) {
  const health = useMemo(() => computeConversationHealth(trace.steps, trace), [trace]);
  const ChannelIcon = CHANNEL_ICON[trace.channel] ?? Languages;

  return (
    <div role="status" aria-live="polite">
      <h2 className="sr-only">{t.aiInspector.health.title}</h2>
      <StatGrid className="grid-cols-2 sm:grid-cols-4">
        <StatCard label={t.aiInspector.health.totalSteps} value={String(health.totalSteps)} icon={ListChecks} />
        <StatCard
          label={t.aiInspector.health.avgConfidence}
          value={health.avgConfidence === null ? t.common.dash : formatPercent(health.avgConfidence)}
          icon={Gauge}
          tone={health.avgConfidence === null ? "default" : CONFIDENCE_TONE[confidenceTone(health.avgConfidence)]}
        />
        <StatCard label={t.aiInspector.health.totalLatency} value={formatDuration(health.totalLatencyMs, locale)} icon={Timer} />
        <StatCard
          label={t.aiInspector.health.duration}
          value={health.durationMs === null ? t.aiInspector.health.ongoing : formatDuration(health.durationMs, locale)}
          icon={Clock}
        />
        <StatCard
          label={t.aiInspector.health.errors}
          value={String(health.errorCount)}
          icon={AlertCircle}
          tone={health.errorCount > 0 ? "destructive" : "default"}
        />
        <StatCard
          label={t.aiInspector.health.warnings}
          value={String(health.warningCount)}
          icon={AlertTriangle}
          tone={health.warningCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t.aiInspector.health.language}
          value={health.language ? (t.aiInspector.language[health.language as keyof typeof t.aiInspector.language] ?? health.language) : t.aiInspector.health.unknown}
          icon={Languages}
        />
        <StatCard
          label={t.aiInspector.health.channel}
          value={t.channel[trace.channel as keyof typeof t.channel] ?? trace.channel}
          icon={ChannelIcon}
        />
      </StatGrid>
    </div>
  );
}
