"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useCoarsePointer } from "@/components/marketing/motion/use-coarse-pointer";

const MAX_TILT_DEGREES = 6;

/**
 * Wraps a ProductFrame with a subtle pointer-driven 3D tilt -- rotates the
 * whole frame (chrome bar + image) as one rigid unit via `transform`, so
 * the screenshot inside is never independently skewed/stretched. Offset
 * is computed relative to this element's own bounding box (RTL-safe, no
 * branching needed). Disabled under prefers-reduced-motion or on
 * coarse-pointer (touch) devices -- renders a plain static wrapper then,
 * so the listener is never attached at all in either case.
 */
export function TiltFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, { stiffness: 150, damping: 20 });
  const rotateY = useSpring(rawRotateY, { stiffness: 150, damping: 20 });
  const shouldReduceMotion = useReducedMotion();
  const isCoarsePointer = useCoarsePointer();
  const enabled = !shouldReduceMotion && !isCoarsePointer;

  if (!enabled) {
    return <div className={className}>{children}</div>;
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const offsetX = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const offsetY = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);
    rawRotateY.set(offsetX * MAX_TILT_DEGREES);
    rawRotateX.set(-offsetY * MAX_TILT_DEGREES);
  }

  function handlePointerLeave() {
    rawRotateX.set(0);
    rawRotateY.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ rotateX, rotateY, transformPerspective: 800, willChange: "transform" }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {children}
    </motion.div>
  );
}
