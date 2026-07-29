"use client";

import { useEffect, useRef } from "react";
import { logFeatureUsage } from "@/app/actions/telemetry";
import { createOnceGuard } from "@/lib/telemetry/once-guard";
import type { FeatureName } from "@/lib/telemetry";

/**
 * Invisible -- renders nothing. Drop into a page's server component to
 * record a "Feature Used" event the first time it mounts client-side.
 * The once-guard (held in a ref, so it survives React's dev-mode
 * double-invoke of effects) ensures at most one event per mount.
 */
export function FeatureUsageBeacon({ feature, clinicId }: { feature: FeatureName; clinicId?: string | null }) {
  const guardRef = useRef(createOnceGuard());

  useEffect(() => {
    guardRef.current.fireOnce(() => {
      void logFeatureUsage(feature, clinicId);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
