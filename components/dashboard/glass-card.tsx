"use client";

import { motion, useReducedMotion } from "motion/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Premium "floating glass" card used across the dashboard: translucent
 * tinted surface, soft ring border, a hover-revealed gradient glow ring
 * (a pure opacity transition on a pseudo-element -- no continuous
 * animation, so it stays compositor-cheap), and a subtle hover lift.
 * Wraps `Card` rather than replacing it, since `Card` itself is used
 * ~25+ places sitewide outside the dashboard.
 */
export function GlassCard({ className, children, ...props }: React.ComponentProps<typeof Card>) {
  const shouldReduceMotion = useReducedMotion();

  const content = (
    <Card
      className={cn(
        "group/glass relative rounded-2xl border-0 bg-foreground/[0.03] shadow-[0_1px_2px_0_rgba(0,0,0,0.03),0_12px_32px_-16px_rgba(0,0,0,0.12)] ring-1 ring-foreground/8 backdrop-blur-xl transition-shadow duration-300 before:pointer-events-none before:absolute before:-inset-px before:rounded-2xl before:bg-gradient-to-br before:from-blue-400/30 before:via-violet-400/15 before:to-transparent before:opacity-0 before:transition-opacity before:duration-300 hover:ring-foreground/15 hover:before:opacity-100 dark:shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset,0_20px_50px_-24px_rgba(0,0,0,0.65)]",
        className,
      )}
      {...props}
    >
      {children}
    </Card>
  );

  if (shouldReduceMotion) return content;

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 300, damping: 24 }}>
      {content}
    </motion.div>
  );
}
