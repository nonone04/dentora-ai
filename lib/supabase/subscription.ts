import type { SupabaseClient } from "@supabase/supabase-js";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "@/lib/stripe/subscriptions";

/** Does this user (as a would-be clinic owner) have an active subscription of their own? RLS-scoped to their own row via subscriptions_select_own. */
export async function hasActiveSubscription(supabase: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .in("status", ACTIVE_SUBSCRIPTION_STATUSES)
    .limit(1)
    .maybeSingle();
  return Boolean(data);
}

/** Does clinicId's owner have an active subscription? Staff inherit access from this -- see the clinic_has_active_subscription SQL function (supabase/migrations/20260802000000_subscriptions.sql). */
export async function clinicHasActiveSubscription(supabase: SupabaseClient, clinicId: string): Promise<boolean> {
  const { data } = await supabase.rpc("clinic_has_active_subscription", { target_clinic_id: clinicId });
  return data === true;
}
