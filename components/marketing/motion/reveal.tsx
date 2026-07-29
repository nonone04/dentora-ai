"use client";

import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

export type RevealVariant = "up" | "left" | "right" | "scale";

const HIDDEN_BY_VARIANT: Record<RevealVariant, Variants["hidden"]> = {
  up: { opacity: 0, y: 24 },
  left: { opacity: 0, x: -24 },
  right: { opacity: 0, x: 24 },
  scale: { opacity: 0, scale: 0.96 },
};

/**
 * Fades (+ slides/scales) content in once it enters the viewport --
 * supersedes the old IntersectionObserver-based ScrollReveal, matching its
 * exact trigger settings (15% visible, -40px bottom margin, fires once)
 * so the migration is behavior-neutral. `delay` is ms, same convention as
 * the old component's `delay={index * 100}` stagger pattern.
 */
export function Reveal({
  children,
  className,
  delay = 0,
  variant = "up",
  once = true,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
  once?: boolean;
}) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      className={cn("will-change-transform", className)}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount: 0.15, margin: "0px 0px -40px 0px" }}
      variants={{
        hidden: HIDDEN_BY_VARIANT[variant],
        visible: { opacity: 1, x: 0, y: 0, scale: 1, transition: { duration: 0.7, ease: "easeOut", delay: delay / 1000 } },
      }}
    >
      {children}
    </motion.div>
  );
}
