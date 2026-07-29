import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading fallback for the calendar page/panel -- mirrors the toolbar +
 * grid shape so layout doesn't jump once real data arrives.
 */
export function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-8 w-16 rounded-lg" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-8 w-48 rounded-lg" />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 min-w-48 flex-1 rounded-lg" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <div className="grid grid-cols-7 gap-px bg-border">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 rounded-none" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-border">
          {Array.from({ length: 21 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-none" style={{ animationDelay: `${(i % 7) * 60}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
