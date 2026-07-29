"use server";

import { getUser } from "@/lib/supabase/auth";
import { track } from "@/lib/telemetry";
import type { FeatureName } from "@/lib/telemetry";

/**
 * Called by components/telemetry/feature-usage-beacon.tsx on mount.
 * Deliberately does not require a session (account/security-style pages
 * are still user-scoped, but a beacon should never be able to break a
 * page by redirecting an unauthenticated visitor) -- if there's no user,
 * the event just carries a null userId.
 */
export async function logFeatureUsage(feature: FeatureName, clinicId?: string | null) {
  const user = await getUser();
  await track({
    name: "Feature Used",
    userId: user?.id ?? null,
    clinicId: clinicId ?? null,
    properties: { feature },
  });
}
