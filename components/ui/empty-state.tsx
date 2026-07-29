import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Generic empty-state block -- reused by every dashboard widget (and
 * available to any future list/table view) when a query succeeds but
 * returns nothing. Icon + title are required; description/action are
 * optional so callers can keep it terse where a longer explanation
 * wouldn't add anything.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center", className)}
    >
      {Icon && (
        <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden="true" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-xs text-sm text-balance text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export { EmptyState }
