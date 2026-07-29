"use client";

import { Pause, Play, RotateCcw, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { interpolate, type Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SPEED_OPTIONS = [1, 2, 4] as const;

/**
 * Pure playback controls over an already-fetched, already-filtered
 * step list -- "replay" here means progressively revealing/highlighting
 * steps the timeline already has, at a controlled pace, not
 * re-invoking any AI engine. All state (current index, playing,
 * speed) is owned by the parent (components/ai-inspector/timeline.tsx)
 * so it can drive the same index into each TimelineStep's
 * dimmed/highlighted props.
 */
export function ReplayControls({
  index,
  total,
  playing,
  speed,
  onPlayPause,
  onStepBack,
  onStepForward,
  onReset,
  onSpeedChange,
  t,
}: {
  index: number | null;
  total: number;
  playing: boolean;
  speed: number;
  onPlayPause: () => void;
  onStepBack: () => void;
  onStepForward: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
  t: Dictionary;
}) {
  const atStart = index === null || index <= 0;
  const atEnd = index !== null && index >= total - 1;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
      <span className="text-xs font-medium text-muted-foreground">{t.aiInspector.replay.label}</span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon-sm" onClick={onStepBack} disabled={atStart} aria-label={t.aiInspector.replay.stepBack}>
          <SkipBack className="size-3.5" aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={onPlayPause}
          disabled={total === 0}
          aria-label={playing ? t.aiInspector.replay.pause : t.aiInspector.replay.play}
        >
          {playing ? <Pause className="size-3.5" aria-hidden="true" /> : <Play className="size-3.5" aria-hidden="true" />}
        </Button>
        <Button type="button" variant="outline" size="icon-sm" onClick={onStepForward} disabled={total === 0 || atEnd} aria-label={t.aiInspector.replay.stepForward}>
          <SkipForward className="size-3.5" aria-hidden="true" />
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onReset} disabled={index === null} aria-label={t.aiInspector.replay.reset}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{t.aiInspector.replay.speed}</span>
        {SPEED_OPTIONS.map((option) => (
          <Button
            key={option}
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn("text-[11px]", speed === option && "bg-accent text-accent-foreground")}
            aria-pressed={speed === option}
            onClick={() => onSpeedChange(option)}
          >
            {option}×
          </Button>
        ))}
      </div>
      {index !== null && total > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums ms-auto">{interpolate(t.aiInspector.replay.progress, { current: index + 1, total })}</span>
      )}
    </div>
  );
}
