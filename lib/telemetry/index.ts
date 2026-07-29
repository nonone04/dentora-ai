import { sanitizeProperties } from "@/lib/telemetry/privacy";
import { createSupabaseAnalyticsProvider } from "@/lib/telemetry/providers/supabase-provider";
import type { AnalyticsProvider } from "@/lib/telemetry/provider";
import type { AnalyticsEvent, AnalyticsUserTraits } from "@/lib/telemetry/events";

/**
 * Single seam for swapping providers later (PostHog, Segment, ...) --
 * change what this returns, and every track()/identify() call site in
 * the app is unaffected.
 */
function getProvider(): AnalyticsProvider {
  return createSupabaseAnalyticsProvider();
}

/**
 * Records a product event. Best-effort and non-blocking: a failure here
 * must never break the user-facing flow it's attached to, so errors are
 * caught and logged rather than thrown. Callers should still `await` this
 * (rather than fire-and-forget) so serverless functions don't get frozen
 * mid-write.
 */
export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    const sanitized = { ...event, properties: sanitizeProperties(event.properties ?? {}) } as AnalyticsEvent;
    await getProvider().capture(sanitized);
  } catch (error) {
    console.error(`lib/telemetry: track("${event.name}") failed`, error);
  }
}

/** Records/updates a user's non-PHI traits. Same best-effort contract as track(). */
export async function identify(userId: string, traits: AnalyticsUserTraits): Promise<void> {
  try {
    await getProvider().identify(userId, traits);
  } catch (error) {
    console.error(`lib/telemetry: identify(${userId}) failed`, error);
  }
}

export type { AnalyticsEvent, AnalyticsUserTraits, AnalyticsEventName, FeatureName } from "@/lib/telemetry/events";
export { FEATURE_NAMES, ONBOARDING_FUNNEL_STEPS } from "@/lib/telemetry/events";
