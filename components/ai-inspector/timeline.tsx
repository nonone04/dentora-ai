"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Filter, Search, X } from "lucide-react";
import { ReplayControls } from "@/components/ai-inspector/replay-controls";
import { TimelineStep } from "@/components/ai-inspector/timeline-step";
import { Accordion } from "@/components/ui/accordion";
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
import { Input } from "@/components/ui/input";
import { matchesStepFilters } from "@/lib/ai-inspector/filters";
import { EMPTY_INSPECTOR_FILTERS, type InspectorFilters } from "@/lib/ai-inspector/types";
import { pluralize, type Dictionary, type Locale } from "@/lib/i18n";
import { TRACE_STEP_TYPES, type ConversationTrace, type TraceStepType } from "@/lib/observability";

/** Base auto-advance interval at 1x replay speed; divided by the selected speed multiplier. */
const BASE_INTERVAL_MS = 1400;

export function Timeline({ trace, t, locale }: { trace: ConversationTrace; t: Dictionary; locale: Locale }) {
  const [filters, setFilters] = useState<InspectorFilters>(EMPTY_INSPECTOR_FILTERS);
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const steps = useMemo(() => trace.steps.filter((step) => matchesStepFilters(step, filters)), [trace.steps, filters]);
  const activeFilterCount = filters.stepTypes.length + (filters.errorsOnly ? 1 : 0);
  const filterKey = filters.stepTypes.join(",");

  // Whenever the conversation or the visible step set changes, drop back
  // to the un-replayed state so a stale index never points past the end
  // of a shorter, newly-filtered list. Adjusted synchronously during
  // render (React's own pattern for "reset state when a key changes")
  // rather than in an effect, so it never causes an extra commit.
  const resetKey = `${trace.conversationId}|${filters.search}|${filters.errorsOnly}|${filterKey}`;
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setReplayIndex(null);
    setPlaying(false);
  }

  useEffect(() => {
    if (!playing || steps.length === 0) return;
    const interval = setInterval(() => {
      setReplayIndex((current) => {
        const next = (current ?? -1) + 1;
        if (next >= steps.length) {
          setPlaying(false);
          return steps.length - 1;
        }
        return next;
      });
    }, BASE_INTERVAL_MS / speed);
    return () => clearInterval(interval);
  }, [playing, speed, steps.length]);

  function toggleStepType(type: TraceStepType) {
    setFilters((current) => ({
      ...current,
      stepTypes: current.stepTypes.includes(type) ? current.stepTypes.filter((s) => s !== type) : [...current.stepTypes, type],
    }));
  }

  function handlePlayPause() {
    if (playing) {
      setPlaying(false);
      return;
    }
    setReplayIndex((current) => (current === null || current >= steps.length - 1 ? 0 : current));
    setPlaying(true);
  }
  function handleStepBack() {
    setPlaying(false);
    setReplayIndex((current) => (current === null ? null : Math.max(0, current - 1)));
  }
  function handleStepForward() {
    setPlaying(false);
    setReplayIndex((current) => (current === null ? 0 : Math.min(steps.length - 1, current + 1)));
  }
  function handleReset() {
    setPlaying(false);
    setReplayIndex(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute inset-y-0 start-2.5 my-auto size-4 text-muted-foreground" aria-hidden="true" />
          <Input
            value={filters.search}
            onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
            placeholder={t.aiInspector.timeline.searchPlaceholder}
            className="ps-8"
            aria-label={t.aiInspector.timeline.searchPlaceholder}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-1.5" />}>
            <Filter className="size-4" aria-hidden="true" />
            {t.aiInspector.timeline.filterByType}
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ms-0.5 h-4 min-w-4 px-1 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{t.aiInspector.timeline.filterByType}</DropdownMenuLabel>
              {TRACE_STEP_TYPES.map((type) => (
                <DropdownMenuCheckboxItem key={type} checked={filters.stepTypes.includes(type)} onCheckedChange={() => toggleStepType(type)}>
                  {t.aiInspector.stepTypes[type]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuCheckboxItem
                checked={filters.errorsOnly}
                onCheckedChange={() => setFilters((current) => ({ ...current, errorsOnly: !current.errorsOnly }))}
              >
                {t.aiInspector.timeline.errorsOnly}
              </DropdownMenuCheckboxItem>
            </DropdownMenuGroup>
            {activeFilterCount > 0 && (
              <>
                <DropdownMenuSeparator />
                <button
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, stepTypes: [], errorsOnly: false }))}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-hidden hover:bg-accent hover:text-accent-foreground"
                >
                  <X className="size-3.5" aria-hidden="true" />
                  {t.aiInspector.timeline.clearFilters}
                </button>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
        <span className="text-xs text-muted-foreground">{pluralize(steps.length, t.aiInspector.timeline.stepCountOne, t.aiInspector.timeline.stepCountOther)}</span>
      </div>

      <ReplayControls
        index={replayIndex}
        total={steps.length}
        playing={playing}
        speed={speed}
        onPlayPause={handlePlayPause}
        onStepBack={handleStepBack}
        onStepForward={handleStepForward}
        onReset={handleReset}
        onSpeedChange={setSpeed}
        t={t}
      />

      {steps.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title={trace.steps.length === 0 ? t.aiInspector.timeline.empty : t.aiInspector.timeline.noResults}
          description={trace.steps.length === 0 ? t.aiInspector.timeline.emptyDescription : undefined}
        />
      ) : (
        <Accordion className="relative rounded-xl py-1 ring-1 ring-foreground/10" multiple>
          <span aria-hidden="true" className="absolute inset-y-3 start-[17px] w-px bg-border" />
          {steps.map((step, index) => (
            <TimelineStep
              key={`${step.type}-${step.timestamp}-${index}`}
              value={`${step.type}-${index}`}
              step={step}
              dimmed={replayIndex !== null && index > replayIndex}
              highlighted={replayIndex === index}
              t={t}
              locale={locale}
            />
          ))}
        </Accordion>
      )}
    </div>
  );
}
