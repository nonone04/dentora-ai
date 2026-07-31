import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { CountUp } from "@/components/dashboard/count-up";
import { GlassCard } from "@/components/dashboard/glass-card";
import { Sparkline } from "@/components/dashboard/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "success" | "warning" | "info" | "brand" | "destructive";

const TONE_BADGE_CLASSES: Record<StatTone, string> = {
  default: "bg-foreground/8 text-muted-foreground",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  brand: "bg-brand/15 text-brand",
  destructive: "bg-destructive/15 text-destructive",
};

const TONE_TEXT_CLASSES: Record<StatTone, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  brand: "text-brand",
  destructive: "text-destructive",
};

export type StatDelta = { label: string; direction: "up" | "down" | "flat" };

function DeltaBadge({ delta, positiveIsGood }: { delta: StatDelta; positiveIsGood: boolean }) {
  const Icon = delta.direction === "up" ? TrendingUp : delta.direction === "down" ? TrendingDown : Minus;
  const isGood = delta.direction === "flat" ? null : delta.direction === "up" === positiveIsGood;
  const colorClass = isGood === null ? "text-muted-foreground" : isGood ? "text-success" : "text-destructive";

  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", colorClass)}>
      <Icon className="size-3" aria-hidden="true" />
      {delta.label}
    </span>
  );
}

/**
 * The base unit of every dashboard KPI row. `tone` picks the icon
 * badge's color from the design system's semantic accents
 * (app/globals.css) -- keep it meaningful (e.g. "destructive" for a
 * rate that's actively bad right now), not decorative.
 *
 * `value` is always the display string (used for the skeleton-free,
 * non-JS-friendly text content); pass `numericValue` alongside it to
 * additionally animate the number in via CountUp once it scrolls into
 * view -- `valueSuffix` is appended after the animated number (e.g. a
 * currency code). CountUp is a Client Component, so this can only be a
 * plain string, not a formatter function.
 */
export function StatCard({
  label,
  value,
  numericValue,
  valueSuffix,
  icon: Icon,
  tone = "default",
  hint,
  delta,
  positiveIsGood = true,
  sparkline,
}: {
  label: string;
  value: string;
  numericValue?: number;
  valueSuffix?: string;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
  delta?: StatDelta;
  positiveIsGood?: boolean;
  sparkline?: number[];
}) {
  return (
    <GlassCard>
      <div className="flex items-start justify-between px-(--card-spacing)">
        <div className={cn("flex size-9 items-center justify-center rounded-xl", TONE_BADGE_CLASSES[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        {delta && <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} />}
      </div>
      <div className="flex items-end justify-between gap-3 px-(--card-spacing)">
        <div className="min-w-0">
          <div className="text-2xl font-semibold tracking-tight text-balance">
            {numericValue !== undefined ? <CountUp value={numericValue} suffix={valueSuffix} /> : value}
          </div>
          <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <Sparkline values={sparkline} toneClassName={TONE_TEXT_CLASSES[tone]} className="mb-1 shrink-0" />
        )}
      </div>
    </GlassCard>
  );
}

export function StatCardSkeleton() {
  return (
    <GlassCard aria-hidden="true">
      <div className="px-(--card-spacing)">
        <Skeleton className="size-9 rounded-xl" />
      </div>
      <div className="flex flex-col gap-2 px-(--card-spacing)">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </GlassCard>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", className)}>{children}</div>;
}
