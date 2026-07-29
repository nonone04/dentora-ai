import { createAdminClient } from "@/lib/supabase/admin";
import type { AnalyticsProvider } from "@/lib/telemetry/provider";
import type { AnalyticsEvent, AnalyticsUserTraits } from "@/lib/telemetry/events";

/**
 * Default provider: writes to the analytics_events / analytics_user_traits
 * tables (see supabase/migrations/20260730050000_product_analytics.sql)
 * via the service-role client, the same way lib/audit/log.ts and
 * lib/auth/security-events.ts write their own tables.
 */
export function createSupabaseAnalyticsProvider(): AnalyticsProvider {
  return {
    async capture(event: AnalyticsEvent) {
      const supabase = createAdminClient();
      const { error } = await supabase.from("analytics_events").insert({
        event_name: event.name,
        clinic_id: event.clinicId ?? null,
        user_id: event.userId ?? null,
        properties: event.properties ?? {},
      });
      if (error) {
        throw new Error(`lib/telemetry: failed to insert analytics_events row for "${event.name}": ${error.message}`);
      }
    },

    async identify(userId: string, traits: AnalyticsUserTraits) {
      const supabase = createAdminClient();
      const { data: existing } = await supabase.from("analytics_user_traits").select("traits").eq("user_id", userId).maybeSingle();

      const merged = { ...(existing?.traits as Record<string, unknown> | null), ...traits };

      const { error } = await supabase.from("analytics_user_traits").upsert({
        user_id: userId,
        traits: merged,
        updated_at: new Date().toISOString(),
      });
      if (error) {
        throw new Error(`lib/telemetry: failed to upsert analytics_user_traits for user ${userId}: ${error.message}`);
      }
    },
  };
}
