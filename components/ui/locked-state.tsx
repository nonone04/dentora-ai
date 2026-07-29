import { Lock } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Shown in place of a widget whose data a role-restricted backend
 * action (requireManager) refused -- e.g. AI operational telemetry,
 * which is owner/admin only. Deliberately not framed as an error: the
 * request never went out, permission was denied by design (see
 * app/actions/analytics.ts).
 */
function LockedState({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center", className)}>
      <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="size-5" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-xs text-sm text-balance text-muted-foreground">{description}</p>}
    </div>
  )
}

export { LockedState }
