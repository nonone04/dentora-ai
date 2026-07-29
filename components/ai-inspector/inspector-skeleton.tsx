import { StatCardSkeleton } from "@/components/dashboard/stat-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Loading fallback for the selected conversation's health summary + timeline, shown while the trace fetch is in flight. */
export function InspectorSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-8 w-full rounded-lg" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="flex flex-col gap-3 rounded-xl p-3 ring-1 ring-foreground/10">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5 py-1">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ))}
      </div>
    </div>
  );
}
