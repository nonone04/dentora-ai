import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "success" | "warning" | "info" | "brand" | "destructive";

const TONE_CLASSES: Record<StatTone, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
  brand: "bg-brand/10 text-brand",
  destructive: "bg-destructive/10 text-destructive",
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
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  tone = "default",
  hint,
  delta,
  positiveIsGood = true,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone?: StatTone;
  hint?: string;
  delta?: StatDelta;
  positiveIsGood?: boolean;
}) {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-sm">
      <div className="flex items-start justify-between px-(--card-spacing)">
        <div className={cn("flex size-8 items-center justify-center rounded-lg", TONE_CLASSES[tone])}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        {delta && <DeltaBadge delta={delta} positiveIsGood={positiveIsGood} />}
      </div>
      <div className="px-(--card-spacing)">
        <div className="text-2xl font-semibold tracking-tight text-balance">{value}</div>
        <div className="mt-0.5 text-sm text-muted-foreground">{label}</div>
        {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </Card>
  );
}

export function StatCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <div className="px-(--card-spacing)">
        <Skeleton className="size-8 rounded-lg" />
      </div>
      <div className="flex flex-col gap-2 px-(--card-spacing)">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-4 w-24" />
      </div>
    </Card>
  );
}

export function StatGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-4", className)}>{children}</div>;
}
