import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Generic error-state block -- what a dashboard widget (or any
 * data-fetching section) renders when its query itself failed, as
 * opposed to succeeding with no rows (see EmptyState). role="alert" so
 * assistive tech announces it the moment it mounts, without the page
 * needing its own live region.
 */
function ErrorState({
  title = "Couldn't load this data",
  description,
  action,
  className,
}: {
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center", className)}>
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-xs text-sm text-balance text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { ErrorState }
