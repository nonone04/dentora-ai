"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  BookOpen,
  Brain,
  CalendarSearch,
  ClipboardList,
  GitBranch,
  MessageSquare,
  RefreshCw,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { confidenceTone, stepConfidence, stepLatencyMs, stepSeverity, type StepSeverity } from "@/lib/ai-inspector/step-meta";
import { stepFields, stepPrimaryText } from "@/lib/ai-inspector/step-fields";
import { formatDuration, formatPercent, formatTime } from "@/lib/format";
import type { Dictionary, Locale } from "@/lib/i18n";
import type { TraceStep, TraceStepType } from "@/lib/observability";
import { cn } from "@/lib/utils";

const STEP_ICON: Record<TraceStepType, LucideIcon> = {
  message: MessageSquare,
  tool_call: Wrench,
  nlu_extraction: Brain,
  decision: GitBranch,
  availability_query: CalendarSearch,
  knowledge_search: BookOpen,
  lifecycle_event: ClipboardList,
  notification_event: Bell,
  turn: RefreshCw,
};

const CONFIDENCE_BADGE_CLASS: Record<ReturnType<typeof confidenceTone>, string> = {
  high: "border-transparent bg-success/10 text-success",
  medium: "border-transparent bg-warning/10 text-warning",
  low: "border-transparent bg-destructive/10 text-destructive",
};

const SEVERITY_DOT_CLASS: Record<StepSeverity, string> = {
  error: "bg-destructive",
  warning: "bg-warning",
  normal: "bg-muted-foreground/40",
};

export function TimelineStep({
  step,
  value,
  dimmed,
  highlighted,
  t,
  locale,
}: {
  step: TraceStep;
  value: string;
  dimmed?: boolean;
  highlighted?: boolean;
  t: Dictionary;
  locale: Locale;
}) {
  const Icon = STEP_ICON[step.type];
  const confidence = stepConfidence(step);
  const latency = stepLatencyMs(step);
  const severity = stepSeverity(step);
  const fields = stepFields(step, t);
  const primary = stepPrimaryText(step, t);

  return (
    <AccordionItem
      value={value}
      className={cn("relative ps-8 transition-opacity duration-300", dimmed && "opacity-35", highlighted && "rounded-lg bg-brand/5")}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute start-[13px] top-4 size-2 shrink-0 rounded-full ring-4 ring-background",
          SEVERITY_DOT_CLASS[severity],
          highlighted && "ring-brand/10",
        )}
      />
      <AccordionTrigger className="items-center gap-3 py-2.5 pe-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{t.aiInspector.stepTypes[step.type]}</span>
              {severity === "error" && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="size-3" aria-hidden="true" />
                  {t.aiInspector.timeline.errorBadge}
                </Badge>
              )}
              {severity === "warning" && (
                <Badge variant="outline" className="gap-1 border-transparent bg-warning/10 text-warning">
                  <AlertTriangle className="size-3" aria-hidden="true" />
                  {t.aiInspector.timeline.warningBadge}
                </Badge>
              )}
            </div>
            <p className="line-clamp-2 text-sm text-foreground">{primary}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {confidence !== null && (
            <Badge variant="outline" className={CONFIDENCE_BADGE_CLASS[confidenceTone(confidence)]}>
              {t.aiInspector.timeline.confidenceLabel} {formatPercent(confidence)}
            </Badge>
          )}
          {latency !== null && (
            <Badge variant="outline">
              {t.aiInspector.timeline.latencyLabel} {formatDuration(latency, locale)}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">{formatTime(step.timestamp, locale)}</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="ps-6">
        {fields.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{field.label}</dt>
                <dd className="text-start break-words">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-ring">{t.aiInspector.timeline.rawDetails}</summary>
          <p className="mt-1.5">
            <span className="font-medium">{t.aiInspector.timeline.rawSummary}:</span> {step.summary}
          </p>
          <pre className="mt-1.5 overflow-x-auto rounded-md bg-muted p-2 text-start" dir="ltr">
            {JSON.stringify(step.data, null, 2)}
          </pre>
        </details>
      </AccordionContent>
    </AccordionItem>
  );
}
