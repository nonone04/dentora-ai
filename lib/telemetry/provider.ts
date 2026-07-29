import type { AnalyticsEvent, AnalyticsUserTraits } from "@/lib/telemetry/events";

/**
 * The seam future providers (PostHog, Segment, ...) plug into. The rest
 * of the app never imports a provider directly -- only lib/telemetry's
 * track()/identify(), which delegate to whatever getProvider() returns.
 */
export type AnalyticsProvider = {
  capture(event: AnalyticsEvent): Promise<void>;
  identify(userId: string, traits: AnalyticsUserTraits): Promise<void>;
};
