"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

function buildLinePath(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return "";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  return values
    .map((v, i) => {
      const x = padding + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
      const y = padding + innerH - ((v - min) / range) * innerH;
      return `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

/**
 * Minimal inline trend line for a stat card -- no axes/labels, just shape.
 * `toneClassName` is a text-color utility; the stroke reads it via
 * `currentColor` so it can share stat-card.tsx's existing tone palette.
 */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  toneClassName = "text-brand",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  toneClassName?: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const path = buildLinePath(values, width, height, 3);

  if (!path) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", toneClassName, className)}
      aria-hidden="true"
    >
      <motion.path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={shouldReduceMotion ? false : { pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </svg>
  );
}
