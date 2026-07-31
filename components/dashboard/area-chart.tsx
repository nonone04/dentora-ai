"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

function buildAreaPaths(values: number[], width: number, height: number, padding: number) {
  if (values.length === 0) return { linePath: "", areaPath: "" };
  const min = Math.min(0, ...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const baseline = height - padding;

  const points = values.map((v, i) => {
    const x = padding + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW);
    const y = padding + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L${last[0].toFixed(2)},${baseline.toFixed(2)} L${first[0].toFixed(2)},${baseline.toFixed(2)} Z`;

  return { linePath, areaPath };
}

/**
 * Animated area/line chart (e.g. the revenue card) -- no axes, just a
 * premium draw-in line with a fading gradient fill beneath it. Renders
 * `preserveAspectRatio="none"` so it always exactly fills the box given
 * to it via `className` (e.g. `h-40 w-full`), independent of the internal
 * `width`/`height` coordinate system used for the path math.
 */
export function AreaChart({
  values,
  width = 560,
  height = 180,
  toneClassName = "text-blue-400",
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  toneClassName?: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const gradientId = useId();
  const { linePath, areaPath } = buildAreaPaths(values, width, height, 8);

  if (!linePath) return null;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("h-40 w-full overflow-visible", toneClassName, className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={areaPath}
        fill={`url(#${gradientId})`}
        stroke="none"
        initial={shouldReduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut", delay: shouldReduceMotion ? 0 : 0.3 }}
      />
      <motion.path
        d={linePath}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={shouldReduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
    </svg>
  );
}
