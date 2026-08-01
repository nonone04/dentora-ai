"use client";

import { useEffect, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { formatCurrency, type CurrencyCode } from "@/lib/currency";
import { cn } from "@/lib/utils";

/**
 * Animated number for dashboard stat cards, counting up on mount. Distinct
 * from components/marketing/motion/count-up.tsx, which only handles
 * pre-parsed integer+narrow-suffix marketing-badge strings and triggers on
 * scroll-into-view (appropriate for below-the-fold marketing sections) --
 * this one locale-formats thousands separators, takes a plain `suffix`
 * string (e.g. " appointments") or a `currency` code rather than a
 * formatter function (this is a Client Component rendered from Server
 * Component widgets, and React can't serialize a function across that
 * boundary, only plain data), and always animates on mount rather than
 * gating on useInView -- these stat cards are already above the fold
 * whenever they render, so there's no "scrolled past it" case to guard
 * against, and it sidesteps IntersectionObserver timing edge cases around
 * Suspense-streamed content.
 */
export function CountUp({
  value,
  suffix = "",
  currency,
  localeTag,
  duration = 1,
  className,
}: {
  value: number;
  suffix?: string;
  currency?: CurrencyCode;
  localeTag?: string;
  duration?: number;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) return;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [value, duration, shouldReduceMotion]);

  const renderedValue = Math.round(shouldReduceMotion ? value : display);

  return (
    <span className={cn("tabular-nums", className)}>
      {currency ? formatCurrency(renderedValue, currency, localeTag) : `${renderedValue.toLocaleString()}${suffix}`}
    </span>
  );
}
