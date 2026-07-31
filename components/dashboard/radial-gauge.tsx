"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Circular progress gauge (e.g. the "clinic health" score) -- SVG
 * stroke-dashoffset animated in on mount, with a centered label slot.
 */
export function RadialGauge({
  value,
  size = 128,
  strokeWidth = 10,
  toneClassName = "text-success",
  trackClassName = "text-foreground/8",
  className,
  children,
}: {
  /** 0-100 */
  value: number;
  size?: number;
  strokeWidth?: number;
  toneClassName?: string;
  trackClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const shouldReduceMotion = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={strokeWidth} fill="none" stroke="currentColor" className={trackClassName} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          className={toneClassName}
          strokeDasharray={circumference}
          initial={shouldReduceMotion ? { strokeDashoffset: offset } : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
