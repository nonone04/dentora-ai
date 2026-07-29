"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useCoarsePointer } from "@/components/marketing/motion/use-coarse-pointer";

type ParallaxContextValue = { x: MotionValue<number>; y: MotionValue<number>; enabled: boolean };

const ParallaxContext = createContext<ParallaxContextValue | null>(null);

/**
 * Establishes a shared pointer-parallax source for `ParallaxLayer`
 * children -- wrap a section with this once, then any number of layers
 * inside it react to the same pointer position at their own `strength`.
 * Pointer offset is computed relative to *this element's own* bounding
 * box center, never viewport edges, so it's identical under `dir="ltr"`
 * and `dir="rtl"` with no branching required. Disabled under
 * prefers-reduced-motion or on coarse-pointer (touch) devices -- the
 * listener is never attached in either case, not just visually suppressed.
 */
export function ParallaxProvider({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.5 });
  const y = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.5 });
  const shouldReduceMotion = useReducedMotion();
  const isCoarsePointer = useCoarsePointer();
  const enabled = !shouldReduceMotion && !isCoarsePointer;

  useEffect(() => {
    const node = ref.current;
    if (!enabled || !node) return;

    function handlePointerMove(event: PointerEvent) {
      const rect = node!.getBoundingClientRect();
      rawX.set((event.clientX - rect.left - rect.width / 2) / (rect.width / 2));
      rawY.set((event.clientY - rect.top - rect.height / 2) / (rect.height / 2));
    }

    node.addEventListener("pointermove", handlePointerMove);
    return () => node.removeEventListener("pointermove", handlePointerMove);
  }, [enabled, rawX, rawY]);

  return (
    <div ref={ref} className={className}>
      <ParallaxContext.Provider value={{ x, y, enabled }}>{children}</ParallaxContext.Provider>
    </div>
  );
}

/** Translates its children by up to `strength` px in response to the nearest ParallaxProvider's pointer position. A static no-op div outside a provider, under reduced motion, or on touch devices. */
export function ParallaxLayer({
  children,
  strength = 12,
  className,
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const context = useContext(ParallaxContext);
  const fallback = useMotionValue(0);
  const x = useTransform(context?.enabled ? context.x : fallback, (v) => v * strength);
  const y = useTransform(context?.enabled ? context.y : fallback, (v) => v * strength);

  if (!context?.enabled) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div className={className} style={{ x, y }}>
      {children}
    </motion.div>
  );
}
