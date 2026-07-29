"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView, useReducedMotion } from "motion/react";

const COUNTABLE_SUFFIXES = ["%", "x", "+"] as const;

export type ParsedCountableValue = { value: number; suffix: string };

/**
 * Recognizes badge values that are safe to animate as a count-up: a
 * leading number followed by nothing, or one of a small allowlist of
 * trailing symbols. Deliberately conservative -- something like "24/7" or
 * "5 min" also starts with digits but isn't a quantity to count up to, so
 * it's rejected (returns null) rather than misread.
 */
export function parseCountableValue(raw: string): ParsedCountableValue | null {
  const match = /^(\d+(?:\.\d+)?)(%|x|\+)?$/.exec(raw.trim());
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  const suffix = match[2] ?? "";
  if (suffix !== "" && !(COUNTABLE_SUFFIXES as readonly string[]).includes(suffix)) return null;
  return { value, suffix };
}

/** Animated number tween, triggered once when scrolled into view. Renders the final value immediately under prefers-reduced-motion (once in view, not before -- reduced motion means no tween, not no reveal). */
export function CountUp({ value, suffix = "", duration = 1.2, className }: { value: number; suffix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.6 });
  const shouldReduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView || shouldReduceMotion) return;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(Math.round(latest)),
    });
    return () => controls.stop();
  }, [isInView, shouldReduceMotion, value, duration]);

  const renderedValue = shouldReduceMotion ? (isInView ? value : 0) : display;

  return (
    <span ref={ref} className={className}>
      {renderedValue}
      {suffix}
    </span>
  );
}
