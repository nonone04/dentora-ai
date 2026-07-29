"use client"

import * as React from "react"
import { Progress as ProgressPrimitive } from "@base-ui/react/progress"

import { cn } from "@/lib/utils"

function Progress({
  className,
  indicatorClassName,
  value,
  ...props
}: Omit<ProgressPrimitive.Root.Props, "children"> & { indicatorClassName?: string }) {
  const clamped = value == null ? null : Math.min(100, Math.max(0, value))

  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      value={clamped}
      className={cn("relative w-full", className)}
      {...props}
    >
      <ProgressPrimitive.Track
        data-slot="progress-track"
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
      >
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn("block h-full rounded-full bg-brand transition-[width] duration-500 ease-out", indicatorClassName)}
          style={{ width: clamped == null ? "35%" : `${clamped}%` }}
        />
      </ProgressPrimitive.Track>
    </ProgressPrimitive.Root>
  )
}

export { Progress }
